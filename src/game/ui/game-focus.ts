// Tracks whether the game is "active", so game keys never hijack the page.
// Active after focus or a pointer press inside the game root; inactive once focus or a
// pointer press lands outside it. Pressing an on-screen button keeps it active.

export interface GameFocus {
  isActive(): boolean;
  /** Called with the new state whenever it changes. */
  onChange(fn: (active: boolean) => void): () => void;
  destroy(): void;
}

export function trackGameFocus(root: HTMLElement, stage: HTMLElement): GameFocus {
  let active = root.contains(document.activeElement) && document.activeElement !== root;
  const listeners = new Set<(active: boolean) => void>();
  const set = (next: boolean) => {
    if (next === active) return;
    active = next;
    if (active) root.dataset.gameActive = '';
    else delete root.dataset.gameActive;
    listeners.forEach((fn) => fn(active));
  };

  const onFocusIn = () => set(true);
  const onFocusOut = (e: FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    // relatedTarget is null when the whole window loses focus; focusin re-activates on return.
    if (!next || !root.contains(next)) set(false);
  };
  const onRootPointer = (e: PointerEvent) => {
    set(true);
    // Clicking the canvas gives the stage keyboard focus (buttons keep theirs).
    const target = e.target as Element | null;
    if (target && !target.closest('button, a, input, select, textarea')) stage.focus({ preventScroll: true });
  };
  const onDocPointer = (e: PointerEvent) => {
    if (!root.contains(e.target as Node)) set(false);
  };

  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  root.addEventListener('pointerdown', onRootPointer);
  document.addEventListener('pointerdown', onDocPointer);

  return {
    isActive: () => active,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    destroy() {
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      root.removeEventListener('pointerdown', onRootPointer);
      document.removeEventListener('pointerdown', onDocPointer);
      listeners.clear();
    },
  };
}
