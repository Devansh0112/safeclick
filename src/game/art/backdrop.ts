// The Neon City night sky: gradient, stars, striped sun, two parallax skylines and the
// synthwave perspective grid. Everything is drawn in code and fixed to the camera.
import Phaser from 'phaser';
import { PALETTE, TONES, hex } from './palette';

const VIEW_W = 1280;
const VIEW_H = 720;
/** Screen y where the skyline meets the grid floor. */
export const HORIZON = 560;

/** Small deterministic rng (mulberry32) so the skyline is the same every visit. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bakeSky(scene: Phaser.Scene): void {
  if (scene.textures.exists('sky')) return;
  const tex = scene.textures.createCanvas('sky', VIEW_W, VIEW_H);
  if (!tex) return;
  const ctx = tex.getContext();
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, PALETTE.bg0);
  sky.addColorStop(1, PALETTE.bg1);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const rand = rng(7);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = 0.25 + rand() * 0.5;
    ctx.fillRect(rand() * VIEW_W, rand() * HORIZON * 0.6, rand() < 0.2 ? 2 : 1.5, rand() < 0.2 ? 2 : 1.5);
  }
  ctx.globalAlpha = 1;

  // Striped synthwave sun sinking behind the city.
  const cx = VIEW_W / 2;
  const cy = HORIZON - 120;
  const r = 170;
  const sun = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  sun.addColorStop(0, TONES.sunTop);
  sun.addColorStop(0.7, TONES.sunBottom);
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = sun;
  ctx.shadowColor = PALETTE.pink;
  ctx.shadowBlur = 40;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = PALETTE.bg1;
  for (let i = 0, y = cy - 20; y < cy + r; i++, y += 16 + i * 2) ctx.fillRect(cx - r, y, r * 2, 3 + i * 2);
  tex.refresh();
}

function bakeSkyline(scene: Phaser.Scene, key: string, opts: { seed: number; h: number; minH: number; fill: string; windows: number }): void {
  if (scene.textures.exists(key)) return;
  const w = 640;
  const rand = rng(opts.seed);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const windowColours = [hex(PALETTE.cyan), hex(PALETTE.pink), hex(PALETTE.gold)];
  let x = 0;
  while (x < w) {
    const bw = Math.min(30 + Math.floor(rand() * 50), w - x);
    const bh = opts.minH + Math.floor(rand() * (opts.h - opts.minH));
    const top = opts.h - bh;
    g.fillStyle(hex(opts.fill), 1);
    g.fillRect(x, top, bw, bh);
    if (rand() < 0.3) g.fillRect(x + bw / 2 - 1, top - 14, 2, 14); // antenna
    for (let wy = top + 10; wy < opts.h - 10; wy += 14) {
      for (let wx = x + 6; wx < x + bw - 8; wx += 10) {
        if (rand() < opts.windows) {
          g.fillStyle(windowColours[Math.floor(rand() * 3)], 0.55 + rand() * 0.35);
          g.fillRect(wx, wy, 4, 4);
        }
      }
    }
    x += bw + (rand() < 0.3 ? 6 : 0);
  }
  g.generateTexture(key, w, opts.h);
  g.destroy();
}

export interface Backdrop {
  /** Call every frame with the camera's scrollX. */
  update(scrollX: number): void;
}

export function createBackdrop(scene: Phaser.Scene): Backdrop {
  bakeSky(scene);
  bakeSkyline(scene, 'skyline-far', { seed: 3, h: 260, minH: 90, fill: TONES.building, windows: 0.08 });
  bakeSkyline(scene, 'skyline-near', { seed: 11, h: 190, minH: 50, fill: TONES.buildingNear, windows: 0.16 });

  scene.add.image(0, 0, 'sky').setOrigin(0).setScrollFactor(0);
  const far = scene.add.tileSprite(0, HORIZON - 260, VIEW_W, 260, 'skyline-far').setOrigin(0).setScrollFactor(0).setAlpha(0.75);
  const near = scene.add.tileSprite(0, HORIZON - 190, VIEW_W, 190, 'skyline-near').setOrigin(0).setScrollFactor(0);

  // Grid floor: horizontal lines stay put, the perspective lines slide with the camera.
  scene.add.rectangle(0, HORIZON, VIEW_W, VIEW_H - HORIZON, hex(TONES.floor)).setOrigin(0).setScrollFactor(0);
  const grid = scene.add.graphics().setScrollFactor(0);
  const horizonLine = scene.add.graphics().setScrollFactor(0);
  // Kept faint so it never reads as a floor Max could stand on.
  for (const [width, alpha] of [[8, 0.06], [2, 0.5]] as const) {
    horizonLine.lineStyle(width, hex(PALETTE.pink), alpha);
    horizonLine.lineBetween(0, HORIZON, VIEW_W, HORIZON);
  }

  const pink = hex(PALETTE.pink);
  const spacing = 80;
  return {
    update(scrollX: number) {
      far.tilePositionX = scrollX * 0.15;
      near.tilePositionX = scrollX * 0.3;
      grid.clear();
      grid.lineStyle(1, pink, 0.28);
      for (let i = 1, y = HORIZON + 10; y < VIEW_H; i++, y += 8 + i * 6) grid.lineBetween(0, y, VIEW_W, y);
      // Each vertical line converges on a vanishing point above the horizon centre.
      const shift = -((scrollX * 0.6) % spacing);
      const vx = VIEW_W / 2;
      for (let x = shift - spacing * 8; x < VIEW_W + spacing * 8; x += spacing) {
        const topX = vx + (x - vx) * 0.25;
        grid.lineBetween(topX, HORIZON, x, VIEW_H);
      }
    },
  };
}
