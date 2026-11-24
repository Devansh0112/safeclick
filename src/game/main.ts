// Mounts the Neon City game. Reads the JSON payload embedded by NeonCityGame.astro
// (JSON.parse only, never executed) and starts Phaser inside [data-game-canvas].
import Phaser from 'phaser';
import type { GamePayload } from './types';

class PlaceholderScene extends Phaser.Scene {
  constructor() { super('placeholder'); }
  create() {
    this.cameras.main.setBackgroundColor('#07021a');
    this.add
      .text(640, 360, 'NEON CITY', { fontFamily: 'sans-serif', fontSize: '96px', color: '#39ff14' })
      .setOrigin(0.5);
  }
}

export function bootNeonCity(root: HTMLElement): void {
  const canvasHost = root.querySelector<HTMLElement>('[data-game-canvas]');
  const payloadEl = root.querySelector<HTMLScriptElement>('script[data-game-payload]');
  if (!canvasHost || !payloadEl?.textContent) return;
  const payload = JSON.parse(payloadEl.textContent) as GamePayload;
  root.dataset.districts = String(payload.districts.length);

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: canvasHost,
    backgroundColor: '#07021a',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 },
    scene: [PlaceholderScene],
  });
}
