// Mounts the Neon City game. Reads the JSON payload embedded by NeonCityGame.astro
// (JSON.parse only, never executed) and starts Phaser inside [data-game-canvas].
import Phaser from 'phaser';
import { PALETTE } from './art/palette';
import { MOVE } from './entities/max';
import { BossScene } from './scenes/BossScene';
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
  const running = (key: string) => {
    const sys = game.scene.getScene(key)?.sys;
    return !!sys && (sys.isActive() || sys.isPaused());
  };
  const shell = createShell(root, payload, store, {
    // No scene runs while the map is open.
    stopScenes: () => {
      for (const key of ['level', 'boss']) if (running(key)) game.scene.stop(key);
    },
    startScene: (choice) => {
      if (choice.type === 'boss') game.scene.start('boss', { districtId: choice.districtId });
      else game.scene.start('level', { districtId: choice.districtId, levelIndex: choice.levelIndex } satisfies LevelInit);
    },
  });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: canvasHost,
    backgroundColor: PALETTE.bg0,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 },
    // Sound is our own Web Audio (audio/sfx.ts), created on the first press; Phaser's would wake at boot.
    audio: { noAudio: true },
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
  // The map is the first screen; the boss is entered from the map or the last Level clear.
  // Dev only: ?boss in the address jumps straight to the fight.
  const devBoss = import.meta.env.DEV && new URLSearchParams(location.search).has('boss');
  game.scene.add('level', LevelScene, false);
  game.scene.add('boss', BossScene, devBoss, { districtId: payload.districts[0]?.id });
  // No autofocus at boot: loading the page must not move focus into the game.
  if (!devBoss) shell.openMap(false);
  // Dev-only handle for browser checks; stripped from production builds.
  if (import.meta.env.DEV) (window as unknown as { __neonCity?: Phaser.Game; __shell?: unknown }).__neonCity = game;
  if (import.meta.env.DEV) (window as unknown as { __shell?: unknown }).__shell = shell;
}
