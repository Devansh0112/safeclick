// Neon City colours (Global Constraints palette plus the background and danger tones).
export const PALETTE = {
  pink: '#ff3d9a',
  cyan: '#18f0ff',
  gold: '#ffd166',
  green: '#39ff88',
  bg0: '#07021a',
  bg1: '#2b0a4d',
  danger: '#ff2e63',
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** '#rrggbb' to 0xrrggbb for Phaser APIs that take numbers. */
export function hex(color: string): number {
  return parseInt(color.slice(1), 16);
}

/** Supporting tones derived from the mockup (hoodie, platform faces, locked gate). */
export const TONES = {
  hoodie: '#1c1a33',
  floor: '#0a0320',
  building: '#0d0526',
  buildingNear: '#140838',
  gateFill: '#1a0533',
  lockedFill: '#110a22',
  lockedLine: '#4a3f66',
  lockedText: '#8e82b3',
  sunTop: '#ff3d9a',
  sunBottom: '#ff9f43',
  text: '#e6f7ff',
} as const;

/** Monospace stack for HUD labels. */
export const HUD_FONT = '"Courier New", ui-monospace, monospace';
