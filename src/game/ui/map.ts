// The district map: the first screen. Per district its title and umbrella habit, the three
// levels (title, habit, best stars as text; locked ones disabled), the boss, the Scam Files
// and a "Coming soon" card for the next district. Plain progress, no streaks, no timers, no
// nagging (spec §6.8). Settings and the Scam Files open on top and the map redraws after.
import type { GameProgress } from '../logic/progress';
import { collectionView, isBossUnlocked, isLevelUnlocked, levelKey } from '../logic/unlocks';
import type { DistrictData, GamePayload } from '../types';
import { button, el, openDialog, type OverlayHost } from './overlays';

export type MapChoice =
  | { type: 'level'; districtId: string; levelIndex: number }
  | { type: 'boss'; districtId: string };

export interface MapHooks {
  progress(): GameProgress;
  sfx(): void;
  openSettings(): Promise<void>;
  openScamFiles(): Promise<void>;
  /** The map's own sound toggle (the game corner is covered by the map). */
  muteButton(): HTMLElement;
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

function districtSection(d: DistrictData, p: GameProgress, pick: (c: MapChoice) => void, firstTodo: { set: boolean }): HTMLElement {
  const section = el('section', 'map-district');
  const headingId = `map-district-${d.id}`;
  section.setAttribute('aria-labelledby', headingId);
  const heading = el('h3', 'map-district-title', d.title.toUpperCase());
  heading.id = headingId;
  section.append(heading, el('p', 'map-habit', `Umbrella habit: ${d.habit}`));

  const list = el('ul', 'map-levels');
  d.levels.forEach((level, i) => {
    const open = isLevelUnlocked(d, i, p);
    const best = p.levels[levelKey(d.id, level.id)];
    const b = el('button', 'map-level');
    b.type = 'button';
    b.append(el('span', 'map-level-name', `LEVEL ${i + 1} · ${level.title}`), el('span', 'map-level-habit', `Habit: ${level.habit}`));
    if (!open) {
      b.disabled = true;
      b.append(el('span', 'map-level-state', 'Locked: clear the level before'));
    } else if (best?.cleared) {
      const glyphs = el('span', 'map-stars', stars(best.bestStars));
      glyphs.setAttribute('aria-hidden', 'true');
      b.append(el('span', 'map-level-state', ''));
      b.lastElementChild!.append(document.createTextNode('Best: '), glyphs, document.createTextNode(` ${best.bestStars} of 3 stars`));
    } else {
      b.append(el('span', 'map-level-state', 'Not cleared yet'));
      if (!firstTodo.set) {
        firstTodo.set = true;
        b.dataset.autofocus = '';
      }
    }
    b.addEventListener('click', () => pick({ type: 'level', districtId: d.id, levelIndex: i }), { once: true });
    const li = el('li');
    li.append(b);
    list.append(li);
  });
  section.append(list);

  const unlocked = isBossUnlocked(d, p);
  const defeated = p.bosses[d.id]?.defeated === true;
  const boss = el('button', 'map-boss');
  boss.type = 'button';
  boss.append(el('span', 'map-boss-name', `⚡ ${d.boss.name}`));
  if (!unlocked) {
    boss.disabled = true;
    boss.append(el('span', 'map-level-state', `Locked: clear all ${d.levels.length} levels first`));
  } else if (defeated) {
    boss.append(el('span', 'map-level-state', 'Defeated ✔'));
  } else {
    boss.append(el('span', 'map-level-state', 'Ready to face'));
    if (!firstTodo.set) {
      firstTodo.set = true;
      boss.dataset.autofocus = '';
    }
  }
  boss.addEventListener('click', () => pick({ type: 'boss', districtId: d.id }), { once: true });
  section.append(boss);
  return section;
}

/**
 * Resolves with the level or boss the player picked. The overlay closes first.
 * The map is the persistent home screen, so it is non-modal (Tab can leave it for the rest of
 * the page). `autofocus` is false when it opens at page load, so loading never moves focus.
 */
export function showMap(host: OverlayHost, payload: GamePayload, hooks: MapHooks, autofocus = true): Promise<MapChoice> {
  return new Promise((resolve) => {
    const title = el('h2', 'ov-title map-title', 'NEON CITY // DISTRICT MAP');
    const dialog = openDialog(host, { className: 'ov-map', title, modal: false, autofocus });
    const header = el('div', 'map-tools');
    const settings = button('ov-btn map-settings', 'Settings', '⚙');
    settings.dataset.key = 'settings';
    header.append(hooks.muteButton(), settings);
    const body = el('div', 'map-body');
    dialog.card.append(header, body);

    const pick = (c: MapChoice) => {
      hooks.sfx();
      dialog.close();
      resolve(c);
    };
    const districts = [...payload.districts].sort((a, b) => a.order - b.order);

    const render = (focusKey?: string, focus = true) => {
      const p = hooks.progress();
      const firstTodo = { set: false };
      const files = button('ov-btn map-files', '', '▦');
      const view = collectionView(payload.scamFiles, p.scamFiles);
      files.append(`Scam Files (${view.filter((v) => v.collected).length}/${payload.scamFiles.length})`);
      files.dataset.key = 'files';
      files.addEventListener('click', () => {
        hooks.sfx();
        void hooks.openScamFiles().then(() => render('files'));
      });
      const soon = el('div', 'map-soon');
      soon.append(el('p', 'map-soon-title', 'Coming soon: Password Tower'), el('p', 'map-soon-text', 'A new district is being built. Max will be back!'));
      const sections = districts.map((d) => districtSection(d, p, pick, firstTodo));
      body.replaceChildren(...sections, files, soon);
      const target = focusKey ? header.querySelector<HTMLElement>(`[data-key="${focusKey}"]`) ?? body.querySelector<HTMLElement>(`[data-key="${focusKey}"]`) : body.querySelector<HTMLElement>('[data-autofocus]');
      if (focus) target?.focus({ preventScroll: true });
    };

    settings.addEventListener('click', () => {
      hooks.sfx();
      void hooks.openSettings().then(() => render('settings'));
    });
    render(undefined, autofocus);
  });
}
