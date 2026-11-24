// Every sprite texture in Neon City is drawn here with Phaser Graphics (no image files).
// Glow is baked in as layered translucent strokes, so it looks the same in WebGL and Canvas.
import Phaser from 'phaser';
import { PALETTE, TONES, hex } from './palette';

type G = Phaser.GameObjects.Graphics;

const C = {
  pink: hex(PALETTE.pink),
  cyan: hex(PALETTE.cyan),
  gold: hex(PALETTE.gold),
  green: hex(PALETTE.green),
  danger: hex(PALETTE.danger),
  hoodie: hex(TONES.hoodie),
  floor: hex(TONES.floor),
  gateFill: hex(TONES.gateFill),
  lockedFill: hex(TONES.lockedFill),
  lockedLine: hex(TONES.lockedLine),
  lockedText: hex(TONES.lockedText),
  botFill: 0x1d0a1f,
  white: 0xffffff,
};

/** Stroke `draw` several times, widest and faintest first, to fake a neon glow. */
function glowStroke(g: G, color: number, width: number, draw: (g: G) => void, strength = 1): void {
  for (const [extra, alpha] of [[12, 0.05], [8, 0.1], [4, 0.22]] as const) {
    g.lineStyle(width + extra, color, alpha * strength);
    draw(g);
  }
  g.lineStyle(width, color, 1);
  draw(g);
}

/** A thick line with round ends (Graphics lines have square caps). */
function limb(g: G, x1: number, y1: number, x2: number, y2: number, width: number, color: number): void {
  g.lineStyle(width, color, 1);
  g.lineBetween(x1, y1, x2, y2);
  g.fillStyle(color, 1);
  g.fillCircle(x1, y1, width / 2);
  g.fillCircle(x2, y2, width / 2);
}

function bake(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

// ---------------------------------------------------------------- Max

export const MAX_SIZE = { w: 64, h: 80 } as const;

interface Pose {
  /** Leg angles from vertical in degrees; positive points forward (right). */
  legs: [number, number];
  arms: [number, number];
  legLen?: [number, number];
  /** Upper-body bob in px (negative = up). */
  bob?: number;
}

const DEG = Math.PI / 180;

function drawMax(g: G, pose: Pose): void {
  const oy = pose.bob ?? 0;
  const [l0, l1] = pose.legLen ?? [17, 17];
  const hips: [number, number][] = [[28, 60 + oy], [36, 60 + oy]];
  const shoulder = { x: 32, y: 43 + oy };
  const legEnd = (i: 0 | 1) => {
    const a = pose.legs[i] * DEG;
    const len = i === 0 ? l0 : l1;
    return [hips[i][0] + Math.sin(a) * len, hips[i][1] + Math.cos(a) * len] as const;
  };
  const armEnd = (i: 0 | 1) => {
    const a = pose.arms[i] * DEG;
    return [shoulder.x + Math.sin(a) * 14, shoulder.y + Math.cos(a) * 14] as const;
  };

  // Back limbs (dimmer) behind the body.
  const [bx, by] = legEnd(1);
  limb(g, hips[1][0], hips[1][1], bx, by, 5, 0x0f9fb0);
  const [bax, bay] = armEnd(1);
  limb(g, shoulder.x, shoulder.y, bax, bay, 5, 0x0f9fb0);

  // Torso (hoodie).
  const torso = [
    new Phaser.Math.Vector2(20, 38 + oy), new Phaser.Math.Vector2(44, 38 + oy),
    new Phaser.Math.Vector2(46, 62 + oy), new Phaser.Math.Vector2(18, 62 + oy),
  ];
  g.fillStyle(C.hoodie, 1);
  g.fillPoints(torso, true);
  glowStroke(g, C.cyan, 2, (gg) => gg.strokePoints(torso, true), 0.8);
  // Pink shield badge: Max is a defender.
  g.fillStyle(C.pink, 1);
  g.fillTriangle(36, 46 + oy, 44, 46 + oy, 40, 55 + oy);
  g.fillRect(36, 44 + oy, 8, 3);

  // Hood and head.
  g.fillStyle(C.hoodie, 1);
  g.fillRoundedRect(17, 8 + oy, 30, 30, { tl: 15, tr: 15, bl: 5, br: 5 });
  glowStroke(g, C.cyan, 2, (gg) => gg.strokeRoundedRect(17, 8 + oy, 30, 30, { tl: 15, tr: 15, bl: 5, br: 5 }), 0.8);
  // Glowing visor.
  for (const [pad, alpha] of [[5, 0.12], [3, 0.25], [1.5, 0.45]] as const) {
    g.fillStyle(C.cyan, alpha);
    g.fillRoundedRect(27 - pad, 18 + oy - pad, 20 + pad * 2, 8 + pad * 2, 4 + pad);
  }
  g.fillStyle(C.cyan, 1);
  g.fillRoundedRect(27, 18 + oy, 20, 8, 4);
  g.fillStyle(C.white, 0.9);
  g.fillRect(40, 20 + oy, 4, 2);

  // Front limbs.
  const [fx, fy] = legEnd(0);
  limb(g, hips[0][0], hips[0][1], fx, fy, 5, C.cyan);
  g.fillStyle(C.white, 1);
  g.fillCircle(fx + 1, fy, 3);
  g.fillCircle(bx + 1, by, 3);
  const [fax, fay] = armEnd(0);
  limb(g, shoulder.x, shoulder.y, fax, fay, 5, C.cyan);
}

const MAX_POSES: Record<string, Pose> = {
  'max-idle': { legs: [6, -6], arms: [12, -12] },
  'max-run-0': { legs: [38, -34], arms: [-40, 40] },
  'max-run-1': { legs: [12, -8], arms: [-12, 12], bob: -2 },
  'max-run-2': { legs: [-34, 38], arms: [40, -40] },
  'max-run-3': { legs: [-8, 12], arms: [12, -12], bob: -2 },
  'max-jump': { legs: [55, -25], arms: [-150, 160], legLen: [13, 16] },
};

// ---------------------------------------------------------------- Gates, portal, foes

export const GATE_SIZE = { w: 120, h: 200 } as const;

function archPath(g: G, close: boolean): void {
  g.beginPath();
  g.moveTo(18, 196);
  g.lineTo(18, 74);
  g.arc(60, 74, 42, Math.PI, 0, false);
  g.lineTo(102, 196);
  if (close) g.closePath();
}

function drawGate(g: G, state: 'active' | 'cleared' | 'locked'): void {
  if (state === 'active') {
    for (const [rx, alpha] of [[60, 0.08], [50, 0.1], [40, 0.12]] as const) {
      g.fillStyle(C.pink, alpha);
      g.fillEllipse(60, 120, rx * 2, rx * 3);
    }
    g.fillStyle(C.gateFill, 1);
    archPath(g, true);
    g.fillPath();
    glowStroke(g, C.pink, 4, (gg) => { archPath(gg, true); gg.strokePath(); });
  } else if (state === 'cleared') {
    glowStroke(g, C.green, 4, (gg) => { archPath(gg, false); gg.strokePath(); });
  } else {
    g.fillStyle(C.lockedFill, 1);
    archPath(g, true);
    g.fillPath();
    g.lineStyle(3, C.lockedLine, 1);
    archPath(g, true);
    g.strokePath();
    // Padlock (shape, not just colour, says "locked").
    g.lineStyle(4, C.lockedText, 1);
    g.beginPath();
    g.arc(60, 118, 9, Math.PI, 0, false);
    g.strokePath();
    g.fillStyle(C.lockedText, 1);
    g.fillRoundedRect(46, 118, 28, 22, 4);
    g.fillStyle(C.lockedFill, 1);
    g.fillCircle(60, 127, 3);
    g.fillRect(59, 127, 2, 7);
  }
}

function drawPortal(g: G): void {
  for (const [rx, ry, alpha] of [[34, 70, 0.08], [28, 62, 0.14], [22, 54, 0.2]] as const) {
    g.fillStyle(C.gold, alpha);
    g.fillEllipse(50, 80, rx * 2, ry * 2);
  }
  glowStroke(g, C.gold, 4, (gg) => gg.strokeEllipse(50, 80, 60, 132));
  g.lineStyle(2, C.pink, 0.8);
  g.strokeEllipse(50, 80, 36, 96);
}

function drawPhishbot(g: G): void {
  // Glitch bars behind.
  g.fillStyle(C.danger, 0.25);
  g.fillRect(4, 30, 150, 3);
  g.fillRect(10, 96, 140, 2);
  // Screen head.
  g.fillStyle(C.botFill, 1);
  g.fillRoundedRect(20, 10, 96, 72, 12);
  glowStroke(g, C.danger, 3, (gg) => gg.strokeRoundedRect(20, 10, 96, 72, 12));
  // Angry chevron eyes > <.
  g.lineStyle(5, C.danger, 1);
  g.strokePoints([new Phaser.Math.Vector2(40, 32), new Phaser.Math.Vector2(54, 42), new Phaser.Math.Vector2(40, 52)], false);
  g.strokePoints([new Phaser.Math.Vector2(96, 32), new Phaser.Math.Vector2(82, 42), new Phaser.Math.Vector2(96, 52)], false);
  // Dashed mouth.
  g.lineStyle(3, C.danger, 1);
  for (let x = 54; x < 84; x += 8) g.lineBetween(x, 66, x + 4, 66);
  // Body.
  g.fillStyle(C.botFill, 1);
  g.fillRoundedRect(46, 86, 44, 40, 8);
  g.lineStyle(3, C.danger, 1);
  g.strokeRoundedRect(46, 86, 44, 40, 8);
  // Hook arm.
  glowStroke(g, C.danger, 4, (gg) => {
    gg.beginPath();
    gg.moveTo(90, 100);
    gg.lineTo(136, 72);
    gg.lineTo(138, 104);
    gg.arc(128, 104, 10, 0, Math.PI, false);
    gg.strokePath();
  });
  // Legs.
  limb(g, 58, 126, 54, 142, 5, C.danger);
  limb(g, 78, 126, 82, 142, 5, C.danger);
}

function drawCage(g: G): void {
  g.lineStyle(3, C.danger, 1);
  g.strokeRect(4, 4, 82, 102);
  g.lineStyle(2, C.danger, 0.8);
  for (let x = 18; x < 86; x += 14) {
    for (let y = 8; y < 102; y += 10) g.lineBetween(x, y, x, y + 5);
  }
}

function drawSpark(g: G): void {
  for (const [r, alpha] of [[8, 0.2], [5, 0.5], [3, 1]] as const) {
    g.fillStyle(C.white, alpha);
    g.fillCircle(8, 8, r);
  }
}

// ---------------------------------------------------------------- Platforms

/** Extra transparent rows above a platform texture for its glow. */
export const PLATFORM_GLOW = 14;

/** Bakes (once per size) a platform block: dark face, pink grid, glowing cyan top. */
export function platformTexture(scene: Phaser.Scene, w: number, h: number): string {
  const key = `platform-${w}x${h}`;
  bake(scene, key, w, h + PLATFORM_GLOW, (g) => {
    const top = PLATFORM_GLOW;
    g.fillStyle(C.floor, 1);
    g.fillRect(0, top, w, h);
    g.lineStyle(1, C.pink, 0.45);
    for (let y = top + 18; y < top + h; y += 18) g.lineBetween(0, y, w, y);
    for (let x = 20; x < w; x += 40) g.lineBetween(x, top + 4, x, top + h);
    g.lineStyle(2, C.cyan, 0.55);
    g.lineBetween(1, top, 1, top + h);
    g.lineBetween(w - 1, top, w - 1, top + h);
    for (const [y, width, alpha] of [[top - 6, 10, 0.08], [top - 3, 6, 0.16], [top - 1, 3, 0.3]] as const) {
      g.lineStyle(width, C.cyan, alpha);
      g.lineBetween(0, y + width / 2, w, y + width / 2);
    }
    g.fillStyle(C.cyan, 1);
    g.fillRect(0, top, w, 3);
  });
  return key;
}

// ---------------------------------------------------------------- Entry point

/** Creates every sprite texture the Neon City scenes use. Safe to call more than once. */
export function createTextures(scene: Phaser.Scene): void {
  for (const [key, pose] of Object.entries(MAX_POSES)) {
    bake(scene, key, MAX_SIZE.w, MAX_SIZE.h, (g) => drawMax(g, pose));
  }
  bake(scene, 'gate-active', GATE_SIZE.w, GATE_SIZE.h, (g) => drawGate(g, 'active'));
  bake(scene, 'gate-cleared', GATE_SIZE.w, GATE_SIZE.h, (g) => drawGate(g, 'cleared'));
  bake(scene, 'gate-locked', GATE_SIZE.w, GATE_SIZE.h, (g) => drawGate(g, 'locked'));
  bake(scene, 'portal', 100, 160, drawPortal);
  bake(scene, 'phishbot', 160, 150, drawPhishbot);
  bake(scene, 'cage', 90, 110, drawCage);
  bake(scene, 'spark', 16, 16, drawSpark);
}
