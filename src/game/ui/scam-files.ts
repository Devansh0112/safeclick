// PHISH.BOT's stash (spec §6.7): the won files revealed one at a time, then a "Coming soon"
// teaser for the next district. And the Scam Files collection: every file in order, collected
// ones open in full, the rest are locked silhouettes with a text label.
// The file card is plain HTML (title, example, how to spot it, what to do), so the same
// format can later become a printable handout. Text only via textContent.
import type { ScamFileData } from '../types';
import { button, closeOn, el, openDialog, uid, type OverlayHost } from './overlays';

/** One Scam File card. `headingLevel` keeps the outline right inside each screen. */
export function scamFileCard(file: ScamFileData, headingLevel: 'h3' | 'h4' = 'h3'): HTMLElement {
  const card = el('article', 'sf-card');
  const titleId = uid('sf-title');
  card.setAttribute('aria-labelledby', titleId);
  const label = el('p', 'sf-label', 'SCAM FILE');
  const title = el(headingLevel, 'sf-title', file.title);
  title.id = titleId;

  const section = (heading: string, icon: string, text: string) => {
    const s = el('div', 'sf-section');
    const h = el('p', 'sf-section-title');
    const i = el('span', 'ov-icon', icon);
    i.setAttribute('aria-hidden', 'true');
    h.append(i, document.createTextNode(heading));
    s.append(h, el('p', 'sf-section-text', text));
    return s;
  };
  // The example is styled as a message bubble.
  const example = section('Example of the trick', '💬', file.example);
  example.className = 'sf-example';
  card.append(label, title, example, section('How to spot it', '🔍', file.howToSpot), section('What to do', '✔', file.whatToDo));
  return card;
}

function comingSoon(nextDistrictLabel: string): HTMLElement {
  const teaser = el('div', 'sf-teaser');
  teaser.append(
    el('p', 'sf-teaser-title', `Coming soon: ${nextDistrictLabel}`),
    el('p', 'sf-teaser-text', 'These files are a sneak peek of the tricks waiting there.'),
  );
  return teaser;
}

/**
 * The stash reveal. Resolves when closed. With `openCollection`, the last screen also offers
 * "SCAM FILES", which closes the stash and opens the collection (resolving after that closes).
 */
export function showStash(
  host: OverlayHost,
  files: ScamFileData[],
  nextDistrictLabel: string,
  openCollection?: () => Promise<void>,
): Promise<void> {
  return new Promise((resolve) => {
    const title = el('h2', 'ov-title stash-title', "PHISH.BOT'S STASH");
    const introId = uid('stash-intro');
    const dialog = openDialog(host, { className: 'ov-stash', title, describedBy: introId });
    const intro = el('p', 'ov-text stash-intro');
    intro.id = introId;
    // Polite live region: each revealed file is read out while focus stays on the button.
    const stage = el('div', 'stash-stage');
    stage.setAttribute('aria-live', 'polite');
    const actions = el('div', 'clear-actions');
    dialog.card.append(intro, stage, actions);

    let index = 0;

    const showEnd = () => {
      stage.replaceChildren(comingSoon(nextDistrictLabel));
      actions.replaceChildren();
      if (openCollection) {
        const all = button('ov-btn', 'SCAM FILES', '▦');
        all.addEventListener('click', () => {
          dialog.close();
          void openCollection().then(resolve);
        }, { once: true });
        actions.append(all);
      }
      const done = button('ov-btn ov-btn-primary', 'DONE', '✔');
      actions.prepend(done);
      closeOn(dialog, done, undefined, resolve);
      done.focus({ preventScroll: true });
    };

    if (files.length === 0) {
      intro.textContent = 'The stash is empty for now.';
      stage.append(el('p', 'sf-empty', 'More files coming soon'));
      const ok = button('ov-btn ov-btn-primary', 'NEXT', '▶');
      actions.append(ok);
      ok.addEventListener('click', showEnd, { once: true });
      return;
    }

    intro.textContent = `Max cracked it open! ${files.length} Scam ${files.length === 1 ? 'File' : 'Files'} inside.`;
    const counter = el('p', 'stash-count');
    const next = button('ov-btn ov-btn-primary', 'NEXT FILE', '▶');
    actions.append(next);

    const reveal = () => {
      const file = files[index];
      counter.textContent = `File ${index + 1} of ${files.length}`;
      stage.replaceChildren(counter, scamFileCard(file));
      if (index === files.length - 1) next.lastChild!.textContent = 'FINISH';
    };
    next.addEventListener('click', () => {
      index += 1;
      if (index < files.length) reveal();
      else showEnd();
    });
    reveal();
  });
}

/** The Scam Files collection grid. Resolves when closed. */
export function showScamFiles(host: OverlayHost, all: ScamFileData[], view: { file: ScamFileData; collected: boolean }[]): Promise<void> {
  return new Promise((resolve) => {
    const got = view.filter((v) => v.collected).length;
    const title = el('h2', 'ov-title files-title', `SCAM FILES (${got}/${all.length})`);
    const dialog = openDialog(host, { className: 'ov-files', title });
    const body = el('div', 'files-body');
    const close = button('ov-btn ov-btn-primary', 'CLOSE', '✕');
    const actions = el('div', 'clear-actions');
    actions.append(close);
    dialog.card.append(body, actions);
    closeOn(dialog, close, undefined, resolve);

    const grid = el('ul', 'files-grid');
    grid.setAttribute('aria-label', 'Scam Files');
    const showGrid = (focusId?: string) => {
      body.replaceChildren(grid);
      if (focusId) grid.querySelector<HTMLElement>(`[data-file="${CSS.escape(focusId)}"]`)?.focus({ preventScroll: true });
    };
    const showFile = (file: ScamFileData) => {
      const back = button('ov-btn', 'ALL FILES', '◀');
      back.addEventListener('click', () => showGrid(file.id), { once: true });
      const card = scamFileCard(file);
      body.replaceChildren(card, back);
      back.focus({ preventScroll: true });
    };

    if (view.length === 0) grid.append(el('li', 'sf-empty', 'More files coming soon'));
    for (const { file, collected } of view) {
      const li = el('li');
      if (collected) {
        const b = button('files-item', file.title, '📁');
        b.dataset.file = file.id;
        b.append(el('span', 'files-item-state', 'Open'));
        b.addEventListener('click', () => showFile(file));
        li.append(b);
      } else {
        const locked = el('div', 'files-item is-locked');
        const icon = el('span', 'files-silhouette', '🔒');
        icon.setAttribute('aria-hidden', 'true');
        locked.append(icon, el('span', 'files-item-state', 'Locked: beat a boss to unlock'));
        li.append(locked);
      }
      grid.append(li);
    }
    showGrid();
  });
}
