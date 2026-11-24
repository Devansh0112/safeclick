// HTML reading screens over the canvas (spec §7): Caught and the gentle note, plus the
// shared dialog plumbing the other screens (level clear, gate panel) build on.
// DOM only via createElement + textContent; sizes in rem so the site's text size applies.
// Every screen has an explicit button, so Escape is ignored on purpose.

export interface OverlayHost {
  overlay: HTMLElement;
  /** Focus goes back here when a screen closes and nothing better is left. */
  stage: HTMLElement;
  reducedMotion(): boolean;
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(className: string, text: string, icon?: string): HTMLButtonElement {
  const b = el('button', className);
  b.type = 'button';
  if (icon) b.append(el('span', 'ov-icon', icon));
  b.append(document.createTextNode(text));
  b.querySelector('.ov-icon')?.setAttribute('aria-hidden', 'true');
  return b;
}

let nextId = 0;
export const uid = (prefix: string) => `${prefix}-${++nextId}`;

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

const openDialogs = new Set<Dialog>();

/**
 * Removes every open reading screen without resolving it (used when the player leaves for the
 * map: the scene that was waiting is stopped, so its pending promise just never settles).
 */
export function closeAllDialogs(): void {
  for (const d of Array.from(openDialogs)) d.close();
}

export interface Dialog {
  root: HTMLElement;
  card: HTMLElement;
  close(): void;
}

/**
 * Opens a modal screen: role=dialog, aria-modal, other overlay children made inert, Tab kept
 * inside, focus on `[data-autofocus]` or the first button. Closing returns focus to whatever
 * had it (if still usable) or to the game stage, so the game stays "focused".
 */
export function openDialog(h: OverlayHost, opts: { className: string; title: HTMLElement; describedBy?: string }): Dialog {
  const root = el('div', `ov-backdrop ${opts.className}`);
  if (h.reducedMotion()) root.dataset.reducedMotion = '';
  const card = el('div', 'ov-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  opts.title.id ||= uid('ov-title');
  card.setAttribute('aria-labelledby', opts.title.id);
  if (opts.describedBy) card.setAttribute('aria-describedby', opts.describedBy);
  card.append(opts.title);
  root.append(card);

  const previous = document.activeElement as HTMLElement | null;
  const madeInert: HTMLElement[] = [];
  for (const child of Array.from(h.overlay.children) as HTMLElement[]) {
    // The live region and the always-on corner (mute, MAP) stay usable.
    if (child.hasAttribute('data-game-live') || child.hasAttribute('data-game-corner') || child.inert) continue;
    child.inert = true;
    madeInert.push(child);
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  root.addEventListener('keydown', onKey);
  h.overlay.append(root);
  // Focus after the caller has filled the card.
  queueMicrotask(() => {
    const target = card.querySelector<HTMLElement>('[data-autofocus]') ?? card.querySelector<HTMLElement>('button');
    target?.focus({ preventScroll: true });
  });

  let closed = false;
  const dialog: Dialog = {
    root,
    card,
    close() {
      if (closed) return;
      closed = true;
      openDialogs.delete(dialog);
      madeInert.forEach((c) => { c.inert = false; });
      // Move focus before removing the screen, so focus never drops out of the game.
      const back = previous && previous.isConnected && !previous.closest('[inert]') && previous !== document.body ? previous : h.stage;
      back.focus({ preventScroll: true });
      root.removeEventListener('keydown', onKey);
      root.remove();
    },
  };
  openDialogs.add(dialog);
  return dialog;
}

/** Resolve once when `btn` is clicked, then close the dialog. */
export function closeOn<T>(dialog: Dialog, btn: HTMLButtonElement, value: T, resolve: (v: T) => void): void {
  btn.addEventListener('click', () => {
    dialog.close();
    resolve(value);
  }, { once: true });
}

export function showCaught(host: OverlayHost, o: { botName: string; redFlag: string; retryLabel: string }): Promise<void> {
  return new Promise((resolve) => {
    const title = el('h2', 'ov-title caught-title', `!! CAUGHT BY ${o.botName} !!`);
    const flagId = uid('caught-flag');
    const dialog = openDialog(host, { className: 'ov-caught', title, describedBy: flagId });
    const bot = el('p', 'caught-bot', '[ >_< ]');
    bot.setAttribute('aria-hidden', 'true');
    const flag = el('p', 'caught-flag');
    flag.id = flagId;
    const flagLabel = el('span', 'caught-flag-label', '⚑ Red flag: ');
    flag.append(flagLabel, document.createTextNode(o.redFlag));
    const cheer = el('p', 'ov-text', 'Max is stuck in a data cage for a second. Now you know the trick, so try again!');
    const retry = button('ov-btn ov-btn-primary', o.retryLabel, '↻');
    dialog.card.append(bot, flag, cheer, retry);
    closeOn(dialog, retry, undefined, resolve);
  });
}

export function showNote(host: OverlayHost, text: string): Promise<void> {
  return new Promise((resolve) => {
    const title = el('h2', 'ov-title note-title', 'GOOD CAUTION! THIS ONE IS SAFE');
    const textId = uid('note-text');
    const dialog = openDialog(host, { className: 'ov-note', title, describedBy: textId });
    const body = el('p', 'ov-text', text);
    body.id = textId;
    const ok = button('ov-btn ov-btn-primary', 'OK, TRY AGAIN');
    dialog.card.append(body, ok);
    closeOn(dialog, ok, undefined, resolve);
  });
}
