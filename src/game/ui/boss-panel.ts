// HTML boss decision panel, below the canvas: the current (nearest) message card's text,
// readable on a phone and following the site's text size and contrast, between two real
// buttons, 🛡 SHIELD and ✔ LET IT THROUGH. The canvas cards stay as the scene.
//
// Keys (heard on the game root, so only while the game is focused): S or ← shields,
// L or → lets it through. Held keys never act (key-repeat is ignored), and any action
// within ACTION_GAP_MS of the previous one (key, click or tap) is ignored, so mashing S
// or a double tap resolves only the current card, never the next one as well.
import { el } from './overlays';

export type BossChoice = 'shield' | 'pass';

const ACTION_GAP_MS = 300;
const TOAST_MS = 1800;
const KEYS: Record<string, BossChoice> = { s: 'shield', S: 'shield', ArrowLeft: 'shield', l: 'pass', L: 'pass', ArrowRight: 'pass' };
const INTERACTIVE = 'button, a, input, select, textarea, summary, [contenteditable]';

export interface BossPanelOptions {
  /** Shown until the first card arrives. */
  intro: string;
  onChoose(choice: BossChoice): void;
  /** Whether game keys count (the game is focused). */
  keysActive(): boolean;
}

export interface BossPanel {
  /** The card nearest Max, or null while none is in flight. */
  setCurrent(text: string | null): void;
  /** Busy while the fight is over or frozen behind a screen: choices are ignored. */
  setBusy(busy: boolean): void;
  /** A small non-blocking note, e.g. "That one was real". */
  toast(text: string): void;
  destroy(): void;
}

export function mountBossPanel(root: HTMLElement, stage: HTMLElement, o: BossPanelOptions): BossPanel {
  const panel = el('section', 'boss-panel');
  panel.setAttribute('aria-label', 'Boss fight controls');

  const now = el('div', 'boss-now');
  const nowLabel = el('p', 'boss-now-label', 'PHISH.BOT SAYS');
  const nowText = el('p', 'boss-now-text', o.intro);
  const toast = el('p', 'boss-toast');
  toast.hidden = true;
  now.append(nowLabel, nowText, toast);

  const makeButton = (choice: BossChoice, icon: string, text: string, keys: string, shortcut: string) => {
    const b = el('button', `boss-btn boss-btn-${choice}`);
    b.type = 'button';
    b.setAttribute('aria-keyshortcuts', shortcut);
    const i = el('span', 'boss-btn-icon', icon);
    i.setAttribute('aria-hidden', 'true');
    const k = el('span', 'boss-btn-keys', keys);
    k.setAttribute('aria-hidden', 'true');
    b.append(i, el('span', 'boss-btn-text', text), k);
    b.addEventListener('click', () => act(choice));
    return b;
  };
  const shield = makeButton('shield', '🛡', 'SHIELD', 'S / ←', 'S ArrowLeft');
  const pass = makeButton('pass', '✔', 'LET IT THROUGH', 'L / →', 'L ArrowRight');
  const hint = el('p', 'boss-hint', 'Fake? SHIELD it. Real? LET IT THROUGH.');
  panel.append(now, shield, pass, hint);

  let busy = false;
  let lastAction = -Infinity;
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  function act(choice: BossChoice): void {
    const t = performance.now();
    const tooSoon = t - lastAction < ACTION_GAP_MS;
    lastAction = t;
    if (busy || tooSoon) return;
    o.onChoose(choice);
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !o.keysActive()) return;
    const target = e.target as Element | null;
    // Keys inside a reading screen (Caught, stash) belong to that screen.
    if (target?.closest?.('[role="dialog"]')) return;
    const choice = KEYS[e.key];
    const onControl = !!target?.closest?.(INTERACTIVE);
    if (!choice) {
      // Held Enter/Space on a focused button would click it again and again.
      if (e.repeat && (e.key === 'Enter' || e.key === ' ') && panel.contains(target)) e.preventDefault();
      // Space and the other arrows would scroll the page under the fight.
      else if ((e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') && !onControl) e.preventDefault();
      return;
    }
    e.preventDefault();
    if (e.repeat) return;
    act(choice);
  };
  root.addEventListener('keydown', onKeyDown);
  stage.after(panel);

  return {
    setCurrent(text) {
      nowLabel.textContent = text === null ? 'WAITING FOR A MESSAGE' : 'MESSAGE NOW';
      nowText.textContent = text === null ? '…' : `💬 ${text}`;
    },
    setBusy(b) {
      busy = b;
      panel.classList.toggle('is-busy', b);
      [shield, pass].forEach((btn) => btn.setAttribute('aria-disabled', String(b)));
    },
    toast(text) {
      toast.textContent = text;
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.hidden = true; }, TOAST_MS);
    },
    destroy() {
      clearTimeout(toastTimer);
      root.removeEventListener('keydown', onKeyDown);
      if (panel.contains(document.activeElement)) stage.focus({ preventScroll: true });
      panel.remove();
    },
  };
}
