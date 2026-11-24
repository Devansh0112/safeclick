// Keyboard controls: arrows / A-D to run, Space / Up / W to jump.
// Keys only count while the game is active (focused or pressed, see game-focus.ts), so
// the page scrolls normally with Space and the arrows otherwise. Keys are added without
// Phaser's global capture; while active we stop page scrolling ourselves, except when
// focus is on a button or field inside the game (Space must still press it).
import Phaser from 'phaser';
import type { GameFocus } from './game-focus';
import type { TouchControls } from './touch-controls';

export type ControlSource = Pick<TouchControls, 'left' | 'right' | 'jump'>;

const SCROLL_KEYS = new Set([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const INTERACTIVE = 'button, a, input, select, textarea, summary, [contenteditable]';

export function keyboardControls(scene: Phaser.Scene, focus?: GameFocus): ControlSource & { destroy(): void } {
  const kb = scene.input.keyboard;
  if (!kb) return { left: () => false, right: () => false, jump: () => false, destroy() {} };
  const active = () => focus?.isActive() ?? true;
  const K = Phaser.Input.Keyboard.KeyCodes;
  const keys = kb.addKeys(
    { left: K.LEFT, a: K.A, right: K.RIGHT, d: K.D, up: K.UP, w: K.W, space: K.SPACE },
    false,
  ) as Record<'left' | 'a' | 'right' | 'd' | 'up' | 'w' | 'space', Phaser.Input.Keyboard.Key>;

  const stopScroll = (e: KeyboardEvent) => {
    if (!active() || !SCROLL_KEYS.has(e.key)) return;
    const target = e.target as Element | null;
    if (target?.closest?.(INTERACTIVE)) return;
    e.preventDefault();
  };
  window.addEventListener('keydown', stopScroll);
  // Drop held keys when the game goes inactive so Max never runs on by himself.
  const offChange = focus?.onChange((on) => { if (!on) kb.resetKeys(); });

  const held = (...ks: Phaser.Input.Keyboard.Key[]) => active() && ks.some((k) => k.isDown);
  return {
    left: () => held(keys.left, keys.a),
    right: () => held(keys.right, keys.d),
    jump: () => held(keys.space, keys.up, keys.w),
    destroy: () => {
      window.removeEventListener('keydown', stopScroll);
      offChange?.();
    },
  };
}
