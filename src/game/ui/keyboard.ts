// Keyboard controls: arrows / A-D to run, Space / Up / W to jump.
// Keys are added without Phaser's global capture, so Space and Enter still work on page
// buttons (overlays, touch pad). Instead we stop the page scrolling only when focus is
// not on something interactive.
import Phaser from 'phaser';
import type { TouchControls } from './touch-controls';

export type ControlSource = Pick<TouchControls, 'left' | 'right' | 'jump'>;

const SCROLL_KEYS = new Set([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const INTERACTIVE = 'button, a, input, select, textarea, summary, [contenteditable], [tabindex]:not(canvas)';

export function keyboardControls(scene: Phaser.Scene): ControlSource & { destroy(): void } {
  const kb = scene.input.keyboard;
  if (!kb) return { left: () => false, right: () => false, jump: () => false, destroy() {} };
  const K = Phaser.Input.Keyboard.KeyCodes;
  const keys = kb.addKeys(
    { left: K.LEFT, a: K.A, right: K.RIGHT, d: K.D, up: K.UP, w: K.W, space: K.SPACE },
    false,
  ) as Record<'left' | 'a' | 'right' | 'd' | 'up' | 'w' | 'space', Phaser.Input.Keyboard.Key>;

  const stopScroll = (e: KeyboardEvent) => {
    if (!SCROLL_KEYS.has(e.key)) return;
    const target = e.target as Element | null;
    if (target?.closest?.(INTERACTIVE)) return;
    e.preventDefault();
  };
  window.addEventListener('keydown', stopScroll);

  return {
    left: () => keys.left.isDown || keys.a.isDown,
    right: () => keys.right.isDown || keys.d.isDown,
    jump: () => keys.space.isDown || keys.up.isDown || keys.w.isDown,
    destroy: () => window.removeEventListener('keydown', stopScroll),
  };
}
