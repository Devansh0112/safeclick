// SafeClick story engine. Plain JavaScript, no framework.
//
// SAFETY RULES (do not break these):
//   - Story content is DATA. It is only ever placed on the page with
//     textContent / createTextNode. Never innerHTML, never eval, never
//     new Function, never inserted into attributes that run code.
//   - Links in story text are not supported on purpose.
//
// Story format: see templates/story-template.json and CONTRIBUTING.md.

const STORAGE_KEY = 'sc-progress';
const LEVELS = ['kids', 'everyone', 'builders'];

/** Create an element with optional class and text. Text is always plain text. */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

/** Plain text paragraphs, split on blank lines. */
function paragraphs(parent, text) {
  String(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((p) => parent.appendChild(el('p', null, p)));
}

function readProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveEnding(storyId, sceneId, kind) {
  try {
    const progress = readProgress();
    progress.stories = progress.stories || {};
    const entry = progress.stories[storyId] || { endings: {} };
    entry.endings[sceneId] = kind;
    entry.completed = true;
    progress.stories[storyId] = entry;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable; progress just won't be remembered */
  }
}

const CHANNEL_LABELS = {
  sms: 'Text message',
  call: 'Phone call',
  chat: 'Game chat',
  email: 'Email',
  letter: 'Letter',
  web: 'Website',
  narration: '',
};

const ENDING_LABELS = {
  good: { badge: 'Safe ending', emoji: '🎉' },
  mixed: { badge: 'Close call', emoji: '😮‍💨' },
  bad: { badge: 'The scammer got through', emoji: '😟' },
};

export class StoryEngine {
  /**
   * @param {HTMLElement} root  Element the game renders into.
   * @param {object} story      Parsed story data (already validated at build time).
   * @param {string} storyId
   */
  constructor(root, story, storyId) {
    this.root = root;
    this.story = story;
    this.storyId = storyId;
    this.live = root.querySelector('[data-story-live]');
    this.stage = root.querySelector('[data-story-stage]');
    this.meterBox = root.querySelector('[data-story-meters]');
    document.addEventListener('sc:agechange', () => this.rerender());
  }

  get level() {
    const level = document.documentElement.dataset.age;
    return LEVELS.includes(level) ? level : 'everyone';
  }

  /** Pick the age variant of a field, falling back to the base (Everyone) value. */
  pick(obj, field) {
    const v = obj.variants && obj.variants[this.level];
    return (v && v[field]) || obj[field];
  }

  start() {
    this.meters = {};
    for (const m of this.story.meters) this.meters[m.id] = m.start;
    this.history = []; // [{ sceneId, choiceId }]
    this.mode = 'play';
    this.go(this.story.start, { announce: false, focus: false });
  }

  go(sceneId, { announce = true, focus = true } = {}) {
    this.sceneId = sceneId;
    this.renderMeters();
    this.renderScene();
    if (focus) this.focusHeading();
    if (announce) this.announce(this.sceneHeadingText());
  }

  rerender() {
    if (!this.sceneId) return;
    if (this.mode === 'rewind') this.renderRewind();
    else this.renderScene();
  }

  choose(choice) {
    this.history.push({ sceneId: this.sceneId, choiceId: choice.id });
    const changes = [];
    for (const [id, delta] of Object.entries(choice.effects || {})) {
      const meter = this.story.meters.find((m) => m.id === id);
      if (!meter) continue;
      const before = this.meters[id];
      this.meters[id] = Math.max(meter.min, Math.min(meter.max, before + delta));
      if (this.meters[id] !== before) changes.push(`${meter.label} ${this.meters[id] > before ? 'went up' : 'went down'}`);
    }
    this.go(choice.to);
    if (changes.length) this.announce(changes.join('. ') + '.', true);
  }

  // ---------------------------------------------------------------- rendering

  renderMeters() {
    if (!this.meterBox) return;
    this.meterBox.replaceChildren();
    for (const m of this.story.meters) {
      const value = this.meters[m.id];
      const pct = Math.round(((value - m.min) / (m.max - m.min)) * 100);
      const wrap = el('div', `meter meter--${m.polarity}`);
      const labelId = `meter-${m.id}`;
      const label = el('div', 'meter-label');
      label.id = labelId;
      label.appendChild(el('span', 'meter-name', m.label));
      label.appendChild(el('span', 'meter-value', `${pct}%`));
      const bar = el('div', 'meter-bar');
      bar.setAttribute('role', 'meter');
      bar.setAttribute('aria-labelledby', labelId);
      bar.setAttribute('aria-valuemin', String(m.min));
      bar.setAttribute('aria-valuemax', String(m.max));
      bar.setAttribute('aria-valuenow', String(value));
      if (m.description) bar.title = m.description;
      const fill = el('div', 'meter-fill');
      fill.style.width = `${pct}%`;
      bar.appendChild(fill);
      wrap.append(label, bar);
      this.meterBox.appendChild(wrap);
    }
  }

  sceneHeadingText() {
    const scene = this.story.scenes[this.sceneId];
    if (scene.ending) return scene.ending.title;
    const speaker = this.pick(scene, 'speaker');
    const channel = CHANNEL_LABELS[scene.channel] || '';
    return [channel, speaker].filter(Boolean).join(': ') || 'What happens next';
  }

  renderScene() {
    this.mode = 'play';
    const scene = this.story.scenes[this.sceneId];
    this.stage.replaceChildren();
    if (this.meterBox) this.meterBox.hidden = false;

    const box = el('section', `scene scene--${scene.channel}${scene.ending ? ` scene--ending ending--${scene.ending.kind}` : ''}`);
    const h = el('h2', 'scene-heading', this.sceneHeadingText());
    h.tabIndex = -1;
    if (scene.ending) {
      const info = ENDING_LABELS[scene.ending.kind];
      const badge = el('p', 'ending-badge');
      badge.appendChild(el('span', null, info.emoji)).setAttribute('aria-hidden', 'true');
      badge.appendChild(document.createTextNode(` ${info.badge}`));
      box.appendChild(badge);
    }
    box.appendChild(h);

    const body = el('div', 'scene-body');
    paragraphs(body, this.pick(scene, 'text'));
    box.appendChild(body);

    if (scene.ending) {
      const actions = el('div', 'scene-actions');
      const rewind = el('button', 'btn', '⏪ Rewind: see what happened');
      rewind.type = 'button';
      rewind.addEventListener('click', () => this.renderRewind(true));
      actions.appendChild(rewind);
      box.appendChild(actions);
      saveEnding(this.storyId, this.sceneId, scene.ending.kind);
    } else {
      const list = el('ol', 'choices');
      list.setAttribute('aria-label', 'Your choices');
      scene.choices.forEach((choice, i) => {
        const li = el('li');
        const btn = el('button', 'choice');
        btn.type = 'button';
        btn.appendChild(el('span', 'choice-key', String(i + 1))).setAttribute('aria-hidden', 'true');
        btn.appendChild(el('span', 'choice-text', this.pick(choice, 'label')));
        btn.addEventListener('click', () => this.choose(choice));
        li.appendChild(btn);
        list.appendChild(li);
      });
      box.appendChild(list);
      box.appendChild(el('p', 'choice-hint', 'Tip: press 1, 2, 3… to choose.'));
    }
    this.stage.appendChild(box);
  }

  /** The Rewind screen: replays each choice, shows missed red flags and what to do instead. */
  renderRewind(focus = false) {
    this.mode = 'rewind';
    const endScene = this.story.scenes[this.sceneId];
    this.stage.replaceChildren();

    const box = el('section', 'rewind');
    const h = el('h2', 'scene-heading', '⏪ Rewind');
    h.tabIndex = -1;
    box.appendChild(h);
    box.appendChild(el('p', 'rewind-summary', this.pick(endScene.ending, 'rewindSummary')));

    const steps = el('ol', 'rewind-steps');
    let missed = 0;
    let caught = 0;
    for (const step of this.history) {
      const scene = this.story.scenes[step.sceneId];
      const choice = scene.choices.find((c) => c.id === step.choiceId);
      if (!choice) continue;
      const li = el('li', `rewind-step rewind-step--${choice.safety}`);

      const quote = el('blockquote', 'rewind-quote');
      const sceneText = this.pick(scene, 'text');
      quote.textContent = sceneText.length > 220 ? `${sceneText.slice(0, 217).trimEnd()}…` : sceneText;
      li.appendChild(quote);

      const you = el('p', 'rewind-choice');
      you.appendChild(el('strong', null, 'You chose: '));
      you.appendChild(document.createTextNode(this.pick(choice, 'label')));
      li.appendChild(you);

      if (choice.safety === 'risky') {
        missed++;
        const flag = el('div', 'callout callout--flag');
        flag.appendChild(el('h3', null, '🚩 Red flag you missed'));
        flag.appendChild(el('p', null, this.pick(choice, 'redFlag')));
        li.appendChild(flag);
        const good = el('div', 'callout callout--good');
        good.appendChild(el('h3', null, '✅ What to do instead'));
        good.appendChild(el('p', null, this.pick(choice, 'lesson')));
        li.appendChild(good);
      } else if (choice.safety === 'safe') {
        caught++;
        const good = el('div', 'callout callout--good');
        good.appendChild(el('h3', null, '👍 Good call'));
        if (choice.lesson) good.appendChild(el('p', null, this.pick(choice, 'lesson')));
        li.appendChild(good);
      } else if (choice.lesson) {
        li.appendChild(el('p', 'rewind-note', this.pick(choice, 'lesson')));
      }

      if (scene.redFlags && scene.redFlags.length) {
        const details = el('details', 'rewind-flags');
        details.appendChild(el('summary', null, `Warning signs in this moment (${scene.redFlags.length})`));
        const ul = el('ul');
        scene.redFlags.forEach((f) => ul.appendChild(el('li', null, f)));
        details.appendChild(ul);
        li.appendChild(details);
      }
      steps.appendChild(li);
    }
    box.appendChild(steps);

    const tally = el('p', 'rewind-tally');
    tally.textContent =
      missed === 0
        ? `You spotted every warning sign you met. ${caught ? 'Nice work.' : ''}`.trim()
        : `You made ${caught} safe ${caught === 1 ? 'choice' : 'choices'}. ${missed} warning ${missed === 1 ? 'sign' : 'signs'} slipped past. That's how scams work: they're designed to feel normal. Now you know what to look for.`;
    box.appendChild(tally);

    const actions = el('div', 'scene-actions');
    const again = el('button', 'btn', '↺ Play again');
    again.type = 'button';
    again.addEventListener('click', () => {
      this.start();
      this.focusHeading();
    });
    const back = el('a', 'btn btn--ghost', 'More story games');
    back.href = '/stories/';
    actions.append(again, back);
    box.appendChild(actions);

    this.stage.appendChild(box);
    if (focus) this.focusHeading();
  }

  focusHeading() {
    const h = this.stage.querySelector('.scene-heading');
    if (h) h.focus({ preventScroll: false });
  }

  announce(text, polite = true) {
    if (!this.live) return;
    this.live.setAttribute('aria-live', polite ? 'polite' : 'assertive');
    this.live.textContent = '';
    // Small delay so screen readers notice the change.
    window.setTimeout(() => {
      this.live.textContent = text;
    }, 50);
  }
}

/** Boot every story on the page. Data comes from a JSON script tag, parsed, never executed. */
export function bootStories() {
  document.querySelectorAll('[data-story-root]').forEach((root) => {
    const dataEl = root.querySelector('script[type="application/json"]');
    if (!dataEl) return;
    let story;
    try {
      story = JSON.parse(dataEl.textContent || '');
    } catch {
      root.querySelector('[data-story-stage]').textContent = 'Sorry, this story could not be loaded.';
      return;
    }
    const engine = new StoryEngine(root, story, root.dataset.storyId || 'story');
    root.querySelector('[data-story-intro]')?.setAttribute('hidden', '');
    engine.start();

    // Number keys pick a choice (only when focus isn't in a text field).
    document.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const n = Number.parseInt(e.key, 10);
      if (!Number.isInteger(n) || n < 1) return;
      const buttons = root.querySelectorAll('.choices button');
      if (buttons[n - 1]) {
        e.preventDefault();
        buttons[n - 1].click();
      }
    });
  });
}
