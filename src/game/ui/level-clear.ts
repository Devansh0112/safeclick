// Level clear screen (spec §6.3): stars, the level rule as a command line, the
// "Challenge a grown-up" flip card, then Next level / Replay / Map.
import type { GrownUpChallenge } from '../types';
import { button, closeOn, el, openDialog, uid, type OverlayHost } from './overlays';

export type LevelClearChoice = 'next' | 'replay' | 'map';

export interface LevelClearInfo {
  stars: 1 | 2 | 3;
  rule: string;
  challenge: GrownUpChallenge;
  hasNext: boolean;
}

function grownUpCard(challenge: GrownUpChallenge): HTMLElement {
  const card = el('section', 'grownup');
  const headingId = uid('grownup');
  card.setAttribute('aria-labelledby', headingId);
  const heading = el('h3', 'grownup-title', 'CHALLENGE A GROWN-UP: can you beat them?');
  heading.id = headingId;
  const prompt = el('p', 'grownup-prompt', challenge.prompt);
  const hint = el('p', 'grownup-hint', 'Ask a grown-up to pick one, then tap it to flip the card.');
  const options = el('ul', 'grownup-options');
  const answer = el('div', 'grownup-answer');
  answer.hidden = true;
  answer.setAttribute('role', 'status');

  const buttons = challenge.options.map((text, i) => {
    const li = el('li');
    const b = button('grownup-option', text);
    b.addEventListener('click', () => reveal(i));
    li.append(b);
    options.append(li);
    return b;
  });

  function reveal(picked: number): void {
    if (!answer.hidden) return;
    card.classList.add('is-flipped');
    buttons.forEach((b, i) => {
      b.setAttribute('aria-disabled', 'true');
      const correct = i === challenge.answer;
      // Text labels, not colour alone, mark the real answer and the pick.
      const tag = el('span', correct ? 'grownup-tag is-answer' : 'grownup-tag', correct ? '✔ ANSWER' : i === picked ? 'picked' : '');
      if (tag.textContent) b.prepend(tag);
      if (correct) b.classList.add('is-answer');
    });
    const right = picked === challenge.answer;
    answer.append(
      el('p', 'grownup-verdict', right ? 'Nice spotting! That is the right one.' : `Not quite! The answer is: ${challenge.options[challenge.answer] ?? ''}`),
      el('p', 'grownup-explain', challenge.explain),
    );
    answer.hidden = false;
  }

  card.append(heading, prompt, hint, options, answer);
  return card;
}

export function showLevelClear(host: OverlayHost, o: LevelClearInfo): Promise<LevelClearChoice> {
  return new Promise((resolve) => {
    const title = el('h2', 'ov-title clear-title', 'LEVEL CLEAR');
    const summaryId = uid('clear-summary');
    const dialog = openDialog(host, { className: 'ov-clear', title, describedBy: summaryId });

    const summary = el('div', 'clear-summary');
    summary.id = summaryId;
    const stars = el('p', 'clear-stars');
    const glyphs = el('span', '', '★'.repeat(o.stars) + '☆'.repeat(3 - o.stars));
    glyphs.setAttribute('aria-hidden', 'true');
    stars.append(glyphs, el('span', 'visually-hidden', `${o.stars} of 3 stars`));
    const rule = el('p', 'clear-rule');
    const prompt = el('span', 'clear-rule-prompt', '> ');
    prompt.setAttribute('aria-hidden', 'true');
    rule.append(prompt, document.createTextNode(o.rule.trim() ? o.rule : 'Stop, look and check before you tap.'));
    summary.append(stars, rule);

    const actions = el('div', 'clear-actions');
    const replay = button('ov-btn', 'REPLAY', '↻');
    const map = button('ov-btn', 'MAP', '▦');
    if (o.hasNext) {
      const next = button('ov-btn ov-btn-primary', 'NEXT LEVEL', '▶');
      next.dataset.autofocus = '';
      actions.append(next);
      closeOn(dialog, next, 'next', resolve);
    } else {
      replay.dataset.autofocus = '';
    }
    actions.append(replay, map);
    closeOn(dialog, replay, 'replay', resolve);
    closeOn(dialog, map, 'map', resolve);

    dialog.card.append(summary, grownUpCard(o.challenge), actions);
  });
}
