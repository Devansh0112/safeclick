// Validator rules for the Neon City game content (game districts and scam files).
// Pure functions: each returns a list of error messages, empty when the file is valid.

const MAX_PORTAL_LABEL = 32;
const MAX_ITEM_TEXT = 80;
const MAX_BOSS_TEXT = 60;
const ITEM_KINDS = ['link', 'message', 'popup', 'qr'];
const GATE_TYPES = ['choose-portal', 'trust-or-report'];
const ID = /^[a-z0-9-]+$/;

const blank = (v) => typeof v !== 'string' || !v.trim();

function checkPortalRound(round, where, errs) {
  if (blank(round.prompt)) errs.push(`${where}: missing prompt.`);
  const options = Array.isArray(round.options) ? round.options : [];
  if (options.length < 2 || options.length > 3) errs.push(`${where}: needs 2 or 3 options (has ${options.length}).`);
  const safe = options.filter((o) => o?.safe === true).length;
  if (safe !== 1) errs.push(`${where}: needs exactly one safe option (has ${safe}).`);
  options.forEach((o, i) => {
    const ow = `${where}, option ${i + 1}`;
    if (blank(o?.label)) errs.push(`${ow}: missing label.`);
    else if (o.label.length > MAX_PORTAL_LABEL) errs.push(`${ow}: label is ${o.label.length} characters, but portal labels can be at most ${MAX_PORTAL_LABEL} characters.`);
    if (o?.safe !== true && blank(o?.redFlag)) errs.push(`${ow}: an unsafe option needs a "redFlag" (what the player missed).`);
  });
}

function checkTrustRound(round, where, errs) {
  if (blank(round.prompt)) errs.push(`${where}: missing prompt.`);
  const item = round.item ?? {};
  if (!ITEM_KINDS.includes(item.kind)) errs.push(`${where}: item kind "${item.kind}" must be one of: ${ITEM_KINDS.join(', ')}.`);
  if (blank(item.text)) errs.push(`${where}: item needs text.`);
  else if (item.text.length > MAX_ITEM_TEXT) errs.push(`${where}: item text is ${item.text.length} characters, but it can be at most ${MAX_ITEM_TEXT} characters.`);
  if (typeof round.safe !== 'boolean') errs.push(`${where}: "safe" must be true or false.`);
  else if (round.safe && blank(round.whySafe)) errs.push(`${where}: a safe item needs "whySafe" (shown if the player reports it by mistake).`);
  else if (!round.safe && blank(round.redFlag)) errs.push(`${where}: an unsafe item needs a "redFlag" (what the player missed).`);
}

function checkLevel(level, ctx, errs) {
  const lw = `level "${level.id}"`;
  if (!ID.test(level.id ?? '')) errs.push(`${lw}: ids may only use lowercase letters, numbers and dashes.`);
  for (const f of ['title', 'goal', 'habit', 'rule']) if (blank(level[f])) errs.push(`${lw}: missing "${f}".`);
  if (level.concept !== undefined && !ctx.concepts.has(level.concept)) errs.push(`${lw}: concept "${level.concept}" does not exist in src/content/concepts/.`);

  const g = level.grownUpChallenge;
  if (!g) errs.push(`${lw}: missing "grownUpChallenge".`);
  else {
    if (blank(g.prompt)) errs.push(`${lw}: grownUpChallenge needs a prompt.`);
    if (blank(g.explain)) errs.push(`${lw}: grownUpChallenge needs an explain text.`);
    if (!Array.isArray(g.options) || g.options.length < 2) errs.push(`${lw}: grownUpChallenge needs at least 2 options.`);
    else if (!Number.isInteger(g.answer) || g.answer < 0 || g.answer >= g.options.length) {
      errs.push(`${lw}: grownUpChallenge answer must be a valid index into options (0 to ${g.options.length - 1}).`);
    }
  }

  const gates = Array.isArray(level.gates) ? level.gates : [];
  if (!(level.layout in ctx.layoutGateCounts)) errs.push(`${lw}: layout "${level.layout}" does not exist in src/game/layouts/.`);
  else if (ctx.layoutGateCounts[level.layout] !== gates.length) {
    errs.push(`${lw}: layout "${level.layout}" has ${ctx.layoutGateCounts[level.layout]} gate slots but the level has ${gates.length} gates.`);
  }

  const seen = new Set();
  for (const gate of gates) {
    const gw = `${lw}, gate "${gate.id}"`;
    if (!ID.test(gate.id ?? '')) errs.push(`${gw}: ids may only use lowercase letters, numbers and dashes.`);
    if (seen.has(gate.id)) errs.push(`${gw}: duplicate gate id in this level.`);
    seen.add(gate.id);
    if (!GATE_TYPES.includes(gate.type)) { errs.push(`${gw}: type must be one of: ${GATE_TYPES.join(', ')}.`); continue; }
    const rounds = Array.isArray(gate.rounds) ? gate.rounds : [];
    if (rounds.length < 1) errs.push(`${gw}: needs at least one round.`);
    rounds.forEach((r, i) => {
      const rw = `${gw}, round ${i + 1}`;
      if (gate.type === 'choose-portal') checkPortalRound(r, rw, errs);
      else checkTrustRound(r, rw, errs);
    });
  }
}

function checkBoss(boss, errs) {
  if (!boss) return errs.push('missing "boss".');
  if (blank(boss.name)) errs.push('boss: missing name.');
  if (blank(boss.intro)) errs.push('boss: missing intro.');
  const waves = Array.isArray(boss.waves) ? boss.waves : [];
  if (waves.length !== 3) errs.push(`boss: needs exactly 3 waves (has ${waves.length}).`);
  waves.forEach((w, i) => {
    const ww = `boss wave ${i + 1}`;
    const msgs = Array.isArray(w.messages) ? w.messages : [];
    if (!msgs.some((m) => m.fake === true)) errs.push(`${ww} needs at least one fake message.`);
    if (!msgs.some((m) => m.fake === false)) errs.push(`${ww} needs at least one real message.`);
    msgs.forEach((m, j) => {
      const mw = `${ww}, message ${j + 1}`;
      if (blank(m.text)) errs.push(`${mw}: missing text.`);
      else if (m.text.length > MAX_BOSS_TEXT) errs.push(`${mw}: text is ${m.text.length} characters, but boss messages can be at most ${MAX_BOSS_TEXT} characters.`);
      if (typeof m.fake !== 'boolean') errs.push(`${mw}: "fake" must be true or false.`);
      else if (m.fake && blank(m.redFlag)) errs.push(`${mw}: a fake message needs a "redFlag" (what the player missed).`);
    });
  });
}

/**
 * @param {object} data a game district file
 * @param {{ layoutGateCounts: Record<string, number>, scamFileIds: Set<string>, concepts: Set<string> }} ctx
 * @returns {string[]} error messages (empty when valid)
 */
export function checkGameDistrict(data, ctx) {
  const errs = [];
  if (data.formatVersion !== undefined && data.formatVersion !== 1) errs.push('formatVersion must be 1.');
  if (typeof data.order !== 'number') errs.push('missing numeric "order".');
  if (blank(data.habit)) errs.push('missing "habit".');

  const levels = Array.isArray(data.levels) ? data.levels : [];
  if (levels.length < 1) errs.push('needs at least one level.');
  const seen = new Set();
  for (const level of levels) {
    if (seen.has(level.id)) errs.push(`level "${level.id}": duplicate level id.`);
    seen.add(level.id);
    checkLevel(level, ctx, errs);
  }

  checkBoss(data.boss, errs);

  for (const id of data.scamFileRewards ?? []) {
    if (!ctx.scamFileIds.has(id)) errs.push(`scam file "${id}" does not exist in src/content/scamFiles/.`);
  }
  return errs;
}

/** @param {object} data a scam file @returns {string[]} error messages (empty when valid) */
export function checkScamFile(data) {
  const errs = [];
  for (const f of ['example', 'howToSpot', 'whatToDo', 'district']) {
    if (blank(data[f])) errs.push(`missing "${f}".`);
  }
  return errs;
}
