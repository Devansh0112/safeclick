// HTML gate panel: the gate prompt (and trust-or-report item) plus one real <button> per
// portal, so choices are readable on a phone and follow the site's text size and contrast.
// The canvas portals stay as the scene. Docked at the bottom of the game on wide screens
// (portals stay visible above it); fills the screen on narrow ones.
//
// Keys (only while the game is focused, since they are heard on the game root):
// 1-3 choose, arrows move the selection, Enter chooses the selection. Held or repeated
// keys never choose, and a Space/Enter that started before the panel opened (e.g. Max's
// jump) can't press a button by its key-up. Choice keys (1-N, Enter, Space) are also
// ignored for KEY_GRACE_MS after the panel opens or re-enables, so mashing Enter on
// Retry / OK can't pick a portal in the next round. Clicks and taps are never delayed.
import type { GateChoice } from '../logic/gate-round';
import type { TrustOrReportRound } from '../types';
import { el, uid } from './overlays';

const KINDS: Record<TrustOrReportRound['item']['kind'], { icon: string; label: string }> = {
  link: { icon: '🔗', label: 'Link' },
  message: { icon: '💬', label: 'Message' },
  popup: { icon: '🪟', label: 'Pop-up' },
  qr: { icon: '▦', label: 'QR code' },
};

export const kindInfo = (kind: TrustOrReportRound['item']['kind']) => KINDS[kind] ?? KINDS.message;

const KEY_GRACE_MS = 300;

export interface GatePanelOptions {
  gateLabel: string;
  prompt: string;
  item?: TrustOrReportRound['item'];
  choices: GateChoice[];
  onChoose(position: number): void;
  onSelect(position: number): void;
}

export interface GatePanel {
  select(position: number, focus?: boolean): void;
  /** Busy while an outcome plays out: choices are ignored and marked disabled. */
  setBusy(busy: boolean): void;
  destroy(): void;
}

export function mountGatePanel(overlay: HTMLElement, stage: HTMLElement, o: GatePanelOptions): GatePanel {
  const root = (overlay.closest('[data-game-root]') as HTMLElement | null) ?? overlay;
  const panel = el('section', 'gate-panel');
  const titleId = uid('gate-title');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', titleId);

  const label = el('p', 'gate-panel-label', `${o.gateLabel} // ${o.item ? 'TRUST OR REPORT?' : 'CHOOSE A PORTAL'}`);
  const prompt = el('h2', 'gate-panel-prompt', o.prompt.trim() ? o.prompt : 'Which way is safe?');
  prompt.id = titleId;
  panel.append(label, prompt);

  if (o.item) {
    const kind = kindInfo(o.item.kind);
    const item = el('p', 'gate-item');
    const icon = el('span', 'gate-item-icon', kind.icon);
    icon.setAttribute('aria-hidden', 'true');
    item.append(icon, el('span', 'gate-item-kind', `${kind.label}: `), el('span', 'gate-item-text', o.item.text));
    panel.append(item);
  }

  const list = el('div', 'gate-choices');
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', 'Choices');
  const buttons = o.choices.map((c, i) => {
    const b = el('button', 'gate-choice');
    b.type = 'button';
    b.setAttribute('aria-keyshortcuts', String(i + 1));
    const badge = el('span', 'gate-badge', String(i + 1));
    badge.setAttribute('aria-hidden', 'true');
    b.append(badge);
    if (c.icon) {
      const icon = el('span', 'gate-choice-icon', c.icon);
      icon.setAttribute('aria-hidden', 'true');
      b.append(icon);
    }
    b.append(el('span', 'gate-choice-label', c.label));
    b.addEventListener('click', () => choose(i));
    b.addEventListener('focus', () => select(i));
    list.append(b);
    return b;
  });
  const hint = el('p', 'gate-hint', `Tap a choice, or press 1 to ${o.choices.length}.`);
  panel.append(list, hint);

  let busy = false;
  let keysFrom = performance.now() + KEY_GRACE_MS;
  let selected = 0;
  // Keys pressed down while the panel is open; a key-up without one is a leftover.
  const fresh = new Set<string>();

  function choose(i: number): void {
    if (busy || panel.closest('[inert]') || panel.inert) return;
    o.onChoose(i);
  }

  function select(i: number, focus = false): void {
    selected = (i + buttons.length) % buttons.length;
    buttons.forEach((b, j) => b.classList.toggle('is-selected', j === selected));
    if (focus) buttons[selected].focus({ preventScroll: true });
    o.onSelect(selected);
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (panel.inert || e.ctrlKey || e.metaKey || e.altKey) return;
    const onButton = buttons.includes(e.target as HTMLButtonElement);
    if (e.repeat) {
      if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
      return;
    }
    const n = Number.parseInt(e.key, 10);
    const choiceKey = e.key === 'Enter' || e.key === ' ' || (n >= 1 && n <= buttons.length && String(n) === e.key);
    if (choiceKey && performance.now() < keysFrom) {
      // Also stops Enter's native click; a Space never marked fresh can't click on key-up.
      e.preventDefault();
      return;
    }
    fresh.add(e.key);
    if (n >= 1 && n <= buttons.length && String(n) === e.key) {
      e.preventDefault();
      select(n - 1, true);
      choose(n - 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      select(selected - 1, true);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      select(selected + 1, true);
    } else if (e.key === 'Enter' && !onButton) {
      e.preventDefault();
      choose(selected);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    // Space presses a button on key-up; ignore one whose key-down came before the panel.
    if (e.key === ' ' && !fresh.has(' ') && buttons.includes(e.target as HTMLButtonElement)) e.preventDefault();
    fresh.delete(e.key);
  };
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('keyup', onKeyUp);

  overlay.append(panel);
  select(0, true);

  return {
    select,
    setBusy(b) {
      busy = b;
      if (!b) keysFrom = performance.now() + KEY_GRACE_MS;
      panel.classList.toggle('is-busy', b);
      buttons.forEach((btn) => btn.setAttribute('aria-disabled', String(b)));
    },
    destroy() {
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('keyup', onKeyUp);
      if (panel.contains(document.activeElement)) stage.focus({ preventScroll: true });
      panel.remove();
    },
  };
}
