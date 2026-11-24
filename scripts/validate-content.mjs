#!/usr/bin/env node
// Content validator. Runs before every build (`npm run build`) and on its own
// with `npm run validate`. Exits with code 1 if anything is wrong.
//
// Checks
//   All content:  review fields present and valid; "reviewed" files have a
//                 reviewer, review date and at least one source; concept tags
//                 exist; no raw HTML, scripts or javascript: links anywhere.
//   Stories:      start scene exists; every choice points at a real scene;
//                 every scene is reachable; every scene can reach an ending;
//                 endings have no choices and have a rewind summary; risky
//                 choices explain the red flag and what to do instead; meter
//                 effects name real meters.
//   Game:         districts and scam files follow the rules in scripts/lib/game-checks.mjs
//                 (one safe portal, red flags, text length caps, layouts, boss waves).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { checkGameDistrict, checkScamFile } from './lib/game-checks.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONTENT = join(ROOT, 'src/content');
const REVIEWED = ['cards', 'videos', 'articles', 'stories', 'readings', 'quizzes', 'handouts', 'gameDistricts', 'scamFiles'];
const STATUSES = ['draft', 'in-review', 'reviewed'];
const LEVELS = ['kids', 'everyone', 'builders'];

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${relative(ROOT, file)}: ${msg}`);
const warn = (file, msg) => warnings.push(`${relative(ROOT, file)}: ${msg}`);

function listFiles(dir, exts) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    if (d.isDirectory()) return listFiles(p, exts);
    return exts.includes(extname(d.name)) ? [p] : [];
  });
}

/** Returns { data, body } for .md (frontmatter) or .json files. */
function load(file) {
  const raw = readFileSync(file, 'utf8');
  if (extname(file) === '.json') return { data: JSON.parse(raw), body: '' };
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error('missing frontmatter block (--- ... ---) at the top of the file');
  return { data: parseYaml(m[1]) ?? {}, body: m[2] };
}

// --- Safety: content is data, never code ------------------------------------
const HTML_TAG = /<\s*\/?\s*[a-z!][^>]*>/i;
const DANGEROUS = [
  [/javascript\s*:/i, 'a javascript: link'],
  [/vbscript\s*:/i, 'a vbscript: link'],
  [/data\s*:\s*text\/html/i, 'a data:text/html link'],
  [/\bon[a-z]+\s*=/i, 'an HTML event handler (like onclick=)'],
];

function checkSafeString(file, path, value) {
  if (typeof value !== 'string') return;
  if (HTML_TAG.test(value)) err(file, `${path} contains HTML. Content must be plain text or Markdown, never HTML.`);
  for (const [re, what] of DANGEROUS) if (re.test(value)) err(file, `${path} contains ${what}. This is not allowed.`);
}

function walkStrings(file, value, path = '') {
  if (typeof value === 'string') return checkSafeString(file, path || '(value)', value);
  if (Array.isArray(value)) return value.forEach((v, i) => walkStrings(file, v, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walkStrings(file, v, path ? `${path}.${k}` : k);
  }
}

function checkMarkdownBody(file, body) {
  // Ignore fenced and inline code, where showing "<script>" as an example is fine.
  const prose = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  if (HTML_TAG.test(prose)) err(file, 'Markdown body contains raw HTML. Use plain Markdown only.');
  for (const [re, what] of DANGEROUS) if (re.test(prose)) err(file, `Markdown body contains ${what}.`);
}

// --- Review fields -----------------------------------------------------------
const concepts = new Set(
  listFiles(join(CONTENT, 'concepts'), ['.json']).map((f) => basename(f, '.json')),
);

function checkReviewFields(file, d) {
  for (const field of ['title', 'concept', 'summary']) {
    if (typeof d[field] !== 'string' || !d[field].trim()) err(file, `missing "${field}".`);
  }
  if (!('reviewStatus' in d)) err(file, 'missing "reviewStatus" (use draft, in-review or reviewed).');
  else if (!STATUSES.includes(d.reviewStatus)) err(file, `reviewStatus "${d.reviewStatus}" must be one of: ${STATUSES.join(', ')}.`);
  if (!('reviewer' in d)) err(file, 'missing "reviewer" field (leave it as "" until someone reviews it).');
  if (!Array.isArray(d.sources)) err(file, 'missing "sources" list.');

  if (d.concept && !concepts.has(d.concept)) err(file, `concept "${d.concept}" does not exist in src/content/concepts/.`);
  for (const c of d.relatedConcepts ?? []) if (!concepts.has(c)) err(file, `related concept "${c}" does not exist.`);
  for (const l of d.ageLevels ?? []) if (!LEVELS.includes(l)) err(file, `age level "${l}" must be one of: ${LEVELS.join(', ')}.`);

  if (d.reviewStatus === 'reviewed') {
    if (!d.reviewer || !String(d.reviewer).trim()) err(file, 'is marked reviewed but has no reviewer name.');
    if (!d.reviewDate || Number.isNaN(new Date(d.reviewDate).getTime())) err(file, 'is marked reviewed but has no valid reviewDate (YYYY-MM-DD).');
    if (!Array.isArray(d.sources) || d.sources.length < 1) err(file, 'is marked reviewed but has no source links.');
  }
  for (const [i, s] of (d.sources ?? []).entries()) {
    if (!s?.title || !s?.url) err(file, `sources[${i}] needs a title and a url.`);
    else if (!/^https:\/\//.test(s.url)) err(file, `sources[${i}].url should start with https://`);
  }
}

// --- Stories -----------------------------------------------------------------
function checkStory(file, story) {
  const scenes = story.scenes ?? {};
  const ids = Object.keys(scenes);
  const meterIds = new Set((story.meters ?? []).map((m) => m.id));

  if (!Array.isArray(story.meters) || story.meters.length < 2) err(file, 'needs at least two meters (for example "trust" and "exposure").');
  if (!story.start) err(file, 'missing "start" scene id.');
  else if (!scenes[story.start]) err(file, `start scene "${story.start}" does not exist.`);
  if (ids.length === 0) return err(file, 'has no scenes.');

  for (const [id, s] of Object.entries(scenes)) {
    const where = `scene "${id}"`;
    if (!/^[a-z0-9-]+$/.test(id)) err(file, `${where}: ids may only use lowercase letters, numbers and dashes.`);
    if (!s.text?.trim()) err(file, `${where}: missing text.`);
    const choices = s.choices ?? [];

    if (s.ending) {
      if (choices.length) err(file, `${where}: an ending can't also have choices.`);
      if (!['good', 'bad', 'mixed'].includes(s.ending.kind)) err(file, `${where}: ending.kind must be good, bad or mixed.`);
      if (!s.ending.title?.trim()) err(file, `${where}: ending needs a title.`);
      if (!s.ending.rewindSummary?.trim()) err(file, `${where}: ending needs a rewindSummary for the Rewind screen.`);
    } else if (choices.length === 0) {
      err(file, `${where}: has no choices and is not an ending (dead end). Add choices or an "ending".`);
    }

    const seen = new Set();
    for (const c of choices) {
      const cw = `${where}, choice "${c.id ?? c.label}"`;
      if (!c.id) err(file, `${cw}: missing id.`);
      else if (seen.has(c.id)) err(file, `${cw}: duplicate choice id.`);
      seen.add(c.id);
      if (!c.label?.trim()) err(file, `${cw}: missing label.`);
      if (!c.to) err(file, `${cw}: missing "to".`);
      else if (!scenes[c.to]) err(file, `${cw}: points to scene "${c.to}", which does not exist.`);
      for (const k of Object.keys(c.effects ?? {})) if (!meterIds.has(k)) err(file, `${cw}: effect on unknown meter "${k}".`);
      if (c.safety === 'risky') {
        if (!c.redFlag?.trim()) err(file, `${cw}: risky choice needs a "redFlag" (what the player missed) for the Rewind.`);
        if (!c.lesson?.trim()) err(file, `${cw}: risky choice needs a "lesson" (what to do instead) for the Rewind.`);
      }
      if (c.safety && !['safe', 'risky', 'neutral'].includes(c.safety)) err(file, `${cw}: safety must be safe, risky or neutral.`);
    }
  }

  // Reachability from start.
  if (scenes[story.start]) {
    const reached = new Set([story.start]);
    const queue = [story.start];
    while (queue.length) {
      const s = scenes[queue.shift()];
      for (const c of s?.choices ?? []) {
        if (scenes[c.to] && !reached.has(c.to)) { reached.add(c.to); queue.push(c.to); }
      }
    }
    for (const id of ids) if (!reached.has(id)) err(file, `scene "${id}" can never be reached from the start.`);

    // Every reachable scene must be able to reach an ending (no endless loops).
    const endings = ids.filter((id) => scenes[id].ending);
    if (endings.length === 0) err(file, 'has no endings.');
    const canEnd = new Set(endings);
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of ids) {
        if (canEnd.has(id)) continue;
        if ((scenes[id].choices ?? []).some((c) => canEnd.has(c.to))) { canEnd.add(id); changed = true; }
      }
    }
    for (const id of reached) if (!canEnd.has(id)) err(file, `scene "${id}" can never lead to an ending (the player would be stuck).`);
    const kinds = new Set(endings.filter((id) => reached.has(id)).map((id) => scenes[id].ending.kind));
    if (!kinds.has('good')) warn(file, 'has no reachable good ending. Players should always be able to win.');
  }
}

// --- Quizzes -----------------------------------------------------------------
function checkQuiz(file, quiz) {
  (quiz.questions ?? []).forEach((q, i) => {
    const correct = (q.options ?? []).filter((o) => o.correct).length;
    if (correct !== 1) err(file, `question ${i + 1} should have exactly one correct option (has ${correct}).`);
    (q.options ?? []).forEach((o, j) => {
      if (!o.feedback?.trim()) err(file, `question ${i + 1}, option ${j + 1}: needs kind feedback text.`);
    });
  });
  if ((quiz.questions ?? []).length !== 5) warn(file, `Older Adults quizzes should have 5 questions (has ${(quiz.questions ?? []).length}).`);
}

// --- Game (Neon City) ----------------------------------------------------------
const layoutGateCounts = Object.fromEntries(
  listFiles(join(ROOT, 'src/game/layouts'), ['.json']).map((f) => {
    const layout = JSON.parse(readFileSync(f, 'utf8'));
    return [layout.id ?? basename(f, '.json'), (layout.gates ?? []).length];
  }),
);
const scamFileIds = new Set(listFiles(join(CONTENT, 'scamFiles'), ['.json']).map((f) => basename(f, '.json')));
const gameCtx = { layoutGateCounts, scamFileIds, concepts };

// --- Run ---------------------------------------------------------------------
let count = 0;
for (const collection of REVIEWED) {
  for (const file of listFiles(join(CONTENT, collection), ['.md', '.json'])) {
    count++;
    let loaded;
    try {
      loaded = load(file);
    } catch (e) {
      err(file, `could not be read: ${e.message}`);
      continue;
    }
    const { data, body } = loaded;
    walkStrings(file, data);
    if (body) checkMarkdownBody(file, body);
    checkReviewFields(file, data);
    if (collection === 'stories') checkStory(file, data);
    if (collection === 'quizzes') checkQuiz(file, data);
    if (collection === 'gameDistricts') for (const m of checkGameDistrict(data, gameCtx)) err(file, m);
    if (collection === 'scamFiles') for (const m of checkScamFile(data)) err(file, m);
  }
}

for (const w of warnings) console.warn(`⚠  ${w}`);
if (errors.length) {
  console.error(`\n✖ Content validation failed with ${errors.length} problem${errors.length === 1 ? '' : 's'}:\n`);
  for (const e of errors) console.error(`  • ${e}`);
  console.error('\nSee CONTRIBUTING.md for the file formats.\n');
  process.exit(1);
}
console.log(`✔ Content validation passed (${count} files checked${warnings.length ? `, ${warnings.length} warning(s)` : ''}).`);
