// On-screen ◀ ▶ JUMP buttons for every pointer type (touch, mouse, pen), so the game is
// playable mouse-only or touch-only. Pointer events make press-and-hold work the same
// everywhere; the LevelScene polls their state each frame. CSS lays them out per pointer.

export interface TouchControls {
  left(): boolean;
  right(): boolean;
  jump(): boolean;
  destroy(): void;
}

type Control = 'left' | 'right' | 'jump';

const BUTTONS: { id: Control; label: string; text: string }[] = [
  { id: 'left', label: 'Move left', text: '◀' },
  { id: 'right', label: 'Move right', text: '▶' },
  { id: 'jump', label: 'Jump', text: 'JUMP' },
];

export function mountTouchControls(el: HTMLElement): TouchControls {
  const held: Record<Control, Set<number>> = { left: new Set(), right: new Set(), jump: new Set() };
  const cleanups: (() => void)[] = [];
  const pad = document.createElement('div');
  pad.className = 'touch-pad';

  for (const b of BUTTONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `touch-btn touch-${b.id}`;
    btn.setAttribute('aria-label', b.label);
    btn.textContent = b.text;
    const press = (e: PointerEvent) => {
      e.preventDefault();
      held[b.id].add(e.pointerId);
      btn.classList.add('is-down');
      try { btn.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    };
    const release = (e: PointerEvent) => {
      held[b.id].delete(e.pointerId);
      if (held[b.id].size === 0) btn.classList.remove('is-down');
    };
    // Long-press menus and double-tap zoom would steal the button on phones.
    const noMenu = (e: Event) => e.preventDefault();
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', noMenu);
    cleanups.push(() => {
      btn.removeEventListener('pointerdown', press);
      btn.removeEventListener('pointerup', release);
      btn.removeEventListener('pointercancel', release);
      btn.removeEventListener('lostpointercapture', release);
      btn.removeEventListener('contextmenu', noMenu);
    });
    pad.append(btn);
  }

  el.append(pad);
  el.hidden = false;

  return {
    left: () => held.left.size > 0,
    right: () => held.right.size > 0,
    jump: () => held.jump.size > 0,
    destroy() {
      cleanups.forEach((fn) => fn());
      pad.remove();
    },
  };
}
