// Mounts the Neon City game. Reads the JSON payload embedded by NeonCityGame.astro
// (JSON.parse only, never executed) and starts Phaser inside [data-game-canvas].
import Phaser from 'phaser';
import { PALETTE } from './art/palette';
import { MOVE } from './entities/max';
import { LevelScene, type LevelInit } from './scenes/LevelScene';
import { createShell } from './shell';
import { store } from '../scripts/storage';
import type { GamePayload } from './types';
import { trackGameFocus } from './ui/game-focus';
import { mountHud } from './ui/hud';
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
  const hudEl = root.querySelector<HTMLElement>('[data-game-hud]');
  const hud = hudEl ? mountHud(hudEl) : undefined;
  const touch = touchEl ? mountTouchControls(touchEl) : undefined;
  const stage = root.querySelector<HTMLElement>('[data-game-stage]');
  const focus = stage ? trackGameFocus(root, stage) : undefined;
  if (overlay) mountRotateHint(overlay);
  const start: LevelInit = { districtId: 'link-alley', levelIndex: 0 };
  const shell = createShell(root, payload, store, {
    // Placeholder until the district map (Task 7): back to the district's first level.
    onOpenMap: () => game.scene.getScene('level')?.scene.restart({ ...start }),
  });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: canvasHost,
    backgroundColor: PALETTE.bg0,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: MOVE.gravity } } },
    callbacks: {
      preBoot: (g) => {
        g.registry.set('payload', payload);
        g.registry.set('shell', shell);
        if (touch) g.registry.set('touch', touch);
        if (hud) g.registry.set('hud', hud);
        if (focus) g.registry.set('focus', focus);
      },
    },
  });
  game.scene.add('level', LevelScene, true, start);
  // Dev-only handle for browser checks; stripped from production builds.
  if (import.meta.env.DEV) (window as unknown as { __neonCity?: Phaser.Game }).__neonCity = game;
}
