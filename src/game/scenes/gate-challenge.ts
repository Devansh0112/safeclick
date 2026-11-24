// One gate round on screen. The canvas draws the scene (prompt, numbered portals, Max
// waiting to the side); the HTML gate panel carries the readable prompt and real buttons.
// Both feed the same choose(); GateRound locks after the first choice, so a double press
// counts once, and input stays locked until the outcome and its overlay are done.
//
// run() resolves 'pass' (gate opens) or 'caught' (the caller re-arms the gate for a new
// round). Over-suspicious shows the gentle note and keeps the same round.
import Phaser from 'phaser';
import { HUD_FONT, PALETTE, TONES, hex } from '../art/palette';
import type { GateRound } from '../logic/gate-round';
import type { Shell } from '../shell';
import { kindInfo, mountGatePanel, type GatePanel } from '../ui/gate-panel';

export type GateResult = 'pass' | 'caught';

const READ_FONT = '"Atkinson Hyperlegible", system-ui, sans-serif';
const DEPTH = 30;
/** Everything stays above y≈420 so the docked HTML panel never covers a portal. */
const MAX_POS = { x: 140, y: 400 };

type Layered = Phaser.GameObjects.GameObject & {
  setScrollFactor(x: number): unknown;
  setDepth(d: number): unknown;
};

interface Portal {
  x: number;
  y: number;
  image: Phaser.GameObjects.Image;
  frame: Phaser.GameObjects.Rectangle;
}

/**
 * Break a long label only after . - / or a space, so an address never splits mid-word
 * (a split could look like a different, fake address). A part with no break point stays whole.
 */
function wrapAddress(text: Phaser.GameObjects.Text, value: string, width: number): string {
  const parts = value.split(/(?<=[.\-/ ])/);
  const lines: string[] = [];
  let line = '';
  for (const part of parts) {
    if (line && text.setText(line + part).width > width) {
      lines.push(line);
      line = part;
    } else {
      line += part;
    }
  }
  lines.push(line);
  return lines.map((l) => l.trimEnd()).join('\n');
}

export class GateChallenge {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private portals: Portal[] = [];
  private panel?: GatePanel;
  private maxImg?: Phaser.GameObjects.Image;
  private resolve?: (r: GateResult) => void;
  private finished = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly shell: Shell,
    private readonly gateIndex: number,
    private readonly round: GateRound,
  ) {}

  private get gateLabel(): string {
    return `GATE_0${this.gateIndex + 1}`;
  }

  run(): Promise<GateResult> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.build();
    });
  }

  /** Tear down without resolving (scene shutting down). */
  destroy(): void {
    this.finished = true;
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
    this.panel?.destroy();
    this.panel = undefined;
  }

  // ------------------------------------------------------------ building

  /** Pin to the camera above the level; `lift` puts text above its own backing box. */
  private add<T extends Layered>(o: T, lift = 0): T {
    o.setScrollFactor(0);
    o.setDepth(DEPTH + lift);
    this.objects.push(o);
    return o;
  }

  private build(): void {
    const { scene } = this;
    const view = this.round.view;
    this.add(scene.add.rectangle(0, 0, 1280, 720, hex(PALETTE.bg0), 0.86).setOrigin(0));
    this.add(scene.add.text(640, 28, `${this.gateLabel} // ${view.item ? 'TRUST OR REPORT?' : 'CHOOSE A PORTAL'}`, {
      fontFamily: HUD_FONT, fontSize: '24px', fontStyle: 'bold', color: PALETTE.cyan,
    }).setOrigin(0.5, 0));
    this.add(scene.add.text(640, 62, view.prompt, {
      fontFamily: HUD_FONT, fontSize: '28px', fontStyle: 'bold', color: TONES.text, align: 'center',
      wordWrap: { width: 1100, useAdvancedWrap: true },
    }).setOrigin(0.5, 0));

    // Max waits to the side, never in front of a portal.
    this.maxImg = this.add(scene.add.image(MAX_POS.x, MAX_POS.y, 'max-idle').setOrigin(0.5, 1).setScale(1.5));

    if (view.item) {
      this.buildItemCard(view.item);
      this.buildPortals([560, 920], 400, 1.15, 236);
    } else {
      const xs = view.choices.length === 2 ? [570, 930] : [430, 740, 1050];
      this.buildPortals(xs, 380, 1.3, 128);
    }

    this.panel = mountGatePanel(this.shell.host.overlay, this.shell.host.stage, {
      gateLabel: this.gateLabel,
      prompt: view.prompt,
      item: view.item,
      choices: view.choices,
      onChoose: (i) => this.choose(i),
      onSelect: (i) => this.highlight(i),
    });
  }

  private buildItemCard(item: NonNullable<GateRound['view']['item']>): void {
    const kind = kindInfo(item.kind);
    const text = this.scene.add.text(690, 150, item.text, {
      fontFamily: READ_FONT, fontSize: '26px', color: TONES.text, wordWrap: { width: 640, useAdvancedWrap: true },
    }).setOrigin(0.5);
    const h = Math.max(70, text.height + 28);
    this.add(this.scene.add.rectangle(640, 150, 780, h, hex('#0e1240'), 0.95).setStrokeStyle(2, hex(PALETTE.cyan)));
    this.add(this.scene.add.text(290, 150, kind.icon, { fontFamily: READ_FONT, fontSize: '34px', color: TONES.text }).setOrigin(0.5));
    this.add(text, 1);
  }

  private buildPortals(xs: number[], bottom: number, scale: number, badgeY: number): void {
    const { scene } = this;
    const choices = this.round.view.choices;
    const labelWidth = xs.length === 3 ? 270 : 320;
    xs.forEach((x, i) => {
      const image = this.add(scene.add.image(x, bottom, 'portal').setOrigin(0.5, 1).setScale(scale));
      const midY = bottom - image.displayHeight / 2;
      const c = choices[i];
      const label = scene.add.text(x, midY, '', {
        fontFamily: READ_FONT, fontSize: '24px', fontStyle: 'bold', color: TONES.text, align: 'center',
      }).setOrigin(0.5);
      label.setText(wrapAddress(label, c.icon ? `${c.icon} ${c.label}` : c.label, labelWidth - 20));
      this.add(scene.add.rectangle(x, midY, label.width + 24, label.height + 14, hex(TONES.floor), 0.92)
        .setStrokeStyle(2, hex(c.label === 'REPORT' ? PALETTE.pink : PALETTE.cyan)));
      this.add(label, 1);
      this.add(scene.add.circle(x, badgeY, 22, hex(TONES.floor)).setStrokeStyle(3, hex(PALETTE.gold)));
      this.add(scene.add.text(x, badgeY, String(i + 1), {
        fontFamily: HUD_FONT, fontSize: '28px', fontStyle: 'bold', color: PALETTE.gold,
      }).setOrigin(0.5));
      const top = badgeY - 30;
      const frame = this.add(scene.add.rectangle(x, (top + bottom + 8) / 2, labelWidth + 16, bottom + 8 - top)
        .setStrokeStyle(4, hex(PALETTE.gold), 0));
      frame.setInteractive({ useHandCursor: true });
      frame.on('pointerover', () => this.panel?.select(i));
      frame.on('pointerdown', () => {
        this.panel?.select(i);
        this.choose(i);
      });
      this.portals.push({ x, y: midY, image, frame });
    });
  }

  private highlight(position: number): void {
    // The frame is also the portal's hit area, so it is hidden with stroke alpha, not visibility.
    this.portals.forEach((p, i) => p.frame.setStrokeStyle(4, hex(PALETTE.gold), i === position ? 1 : 0));
  }

  // ------------------------------------------------------------ outcomes

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.scene.time.delayedCall(ms, resolve));
  }

  private async choose(position: number): Promise<void> {
    if (this.finished) return;
    const outcome = this.round.choose(position);
    if (!outcome) return;
    this.panel?.setBusy(true);
    this.shell.sfx('click');

    if (outcome.kind === 'pass') {
      await this.celebrate(position);
      this.finish('pass');
    } else if (outcome.kind === 'caught') {
      await this.caught(position);
      if (this.finished) return;
      await this.shell.showCaught({ botName: 'PHISH.BOT', redFlag: outcome.redFlag, retryLabel: `RETRY ${this.gateLabel}` });
      this.finish('caught');
    } else {
      await this.shell.showNote(outcome.note);
      if (this.finished) return;
      this.round.unlock();
      this.panel?.setBusy(false);
      this.panel?.select(position, true);
    }
  }

  private async celebrate(position: number): Promise<void> {
    const p = this.portals[position];
    this.shell.sfx('gate');
    this.add(this.scene.add.text(p.x, p.y - 150, '✔ ACCESS OK', {
      fontFamily: HUD_FONT, fontSize: '30px', fontStyle: 'bold', color: PALETTE.green,
    }).setOrigin(0.5));
    p.frame.setStrokeStyle(5, hex(PALETTE.green), 1);
    if (!this.shell.reducedMotion()) {
      const sparks = this.add(this.scene.add.particles(0, 0, 'spark', {
        speed: { min: 120, max: 340 }, lifespan: 650, scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 },
        tint: [hex(PALETTE.green), hex(PALETTE.cyan), hex(PALETTE.gold)], blendMode: 'ADD', emitting: false,
      }));
      sparks.explode(36, p.x, p.y);
    }
    await this.wait(this.shell.reducedMotion() ? 450 : 750);
  }

  /** PHISH.BOT pops out of the wrong portal and a data cage drops over Max. Cartoon, not scary. */
  private async caught(position: number): Promise<void> {
    const p = this.portals[position];
    const reduced = this.shell.reducedMotion();
    this.shell.sfx('caught');
    p.image.setVisible(false);
    const bot = this.add(this.scene.add.image(p.x, p.y, 'phishbot').setScale(reduced ? 1 : 0.2));
    const max = this.maxImg!;
    max.setTint(hex(PALETTE.danger));
    const cage = this.add(this.scene.add.image(max.x, max.y + 6, 'cage').setOrigin(0.5, 1).setScale(1.3));
    if (!reduced) {
      this.scene.tweens.add({ targets: bot, scale: 1, duration: 260, ease: 'Back.out' });
      cage.y -= 140;
      this.scene.tweens.add({ targets: cage, y: max.y + 6, duration: 300, ease: 'Bounce.out' });
      // Red glitch: two soft pulses in ~1 s (well under 3 flashes per second).
      const glitch = this.add(this.scene.add.rectangle(0, 0, 1280, 720, hex(PALETTE.danger), 0).setOrigin(0));
      this.scene.tweens.add({ targets: glitch, fillAlpha: 0.18, duration: 250, yoyo: true, repeat: 1 });
    }
    await this.wait(reduced ? 500 : 1000);
  }

  private finish(result: GateResult): void {
    if (this.finished) return;
    this.destroy();
    this.resolve?.(result);
  }
}
