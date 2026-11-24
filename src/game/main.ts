// Mounts the Neon City game. Reads the JSON payload embedded by NeonCityGame.astro
// (JSON.parse only, never executed) and starts Phaser inside [data-game-canvas].
import Phaser from 'phaser';
import { PALETTE } from './art/palette';
import { MOVE } from './entities/max';
import { LevelScene, type LevelInit } from './scenes/LevelScene';
import type { GamePayload } from './types';
import { mountRotateHint } from './ui/rotate-hint';
import { mountTouchControls } from './ui/touch-controls';

export function bootNeonCity(root: HTMLElement): void {
  const canvasHost = root.querySelector<HTMLElement>('[data-game-canvas]');
  const payloadEl = root.querySelector<HTMLScriptElement>('script[data-game-payload]');
  if (!canvasHost || !payloadEl?.textContent) return;
  const payload = JSON.parse(payloadEl.textContent) as GamePayload;
  root.dataset.districts = String(payload.districts.length);

  const touchEl = root.querySelector<HTMLElement>('[data-game-touch]');
  const overlay = root.querySelector<HTMLElement>('[data-game-overlay]');
  const touch = touchEl ? mountTouchControls(touchEl) : undefined;
  if (overlay) mountRotateHint(overlay);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: canvasHost,
    backgroundColor: PALETTE.bg0,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: MOVE.gravity } } },
    callbacks: {
      preBoot: (g) => {
        g.registry.set('payload', payload);
        if (touch) g.registry.set('touch', touch);
      },
    },
  });
  const start: LevelInit = { districtId: 'link-alley', levelIndex: 0 };
  game.scene.add('level', LevelScene, true, start);
  // Dev-only handle for browser checks; stripped from production builds.
  if (import.meta.env.DEV) (window as unknown as { __neonCity?: Phaser.Game }).__neonCity = game;
}
