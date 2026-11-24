// A Neon City platform level: run from start to the exit portal through three gates.
// Gates are solid until Task 5's challenge opens them:
//   emits  'gate-reached' (gateIndex) once when Max touches the active gate,
//   listens 'gate-opened' (gateIndex?) to open it,
//   emits  'level-exit' when Max reaches the portal.
import Phaser from 'phaser';
import { createBackdrop, type Backdrop } from '../art/backdrop';
import { HUD_FONT, PALETTE, hex } from '../art/palette';
import { GATE_SIZE, PLATFORM_GLOW, createTextures, platformTexture } from '../art/textures';
import { Max } from '../entities/max';
import { getLayout } from '../layouts/index';
import type { GamePayload, LayoutData } from '../types';
import type { Hud } from '../ui/hud';
import { keyboardControls, type ControlSource } from '../ui/keyboard';

export interface LevelInit {
  districtId: string;
  levelIndex: number;
  reducedMotion?: boolean;
}

type Platform = LayoutData['platforms'][number];

interface Gate {
  x: number;
  image: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  mark: Phaser.GameObjects.Text;
  blocker: Phaser.GameObjects.Zone;
  reached: boolean;
}

interface Mover {
  image: Phaser.Physics.Arcade.Image;
  base: { x: number; y: number };
  move: NonNullable<Platform['moving']>;
}

const GATE_BODY = { w: 60, h: 190 };

export class LevelScene extends Phaser.Scene {
  private init_!: LevelInit;
  private layout!: LayoutData;
  private reducedMotion = false;
  private max!: Max;
  private backdrop!: Backdrop;
  private gates: Gate[] = [];
  private movers: Mover[] = [];
  private opened = 0;
  private exited = false;
  private elapsed = 0;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hud?: Hud;
  private pausedByVisibility = false;
  private lastTrail = 0;

  constructor() {
    super('level');
  }

  init(data: LevelInit): void {
    this.init_ = data;
    this.reducedMotion = data.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.gates = [];
    this.movers = [];
    this.opened = 0;
    this.exited = false;
    this.elapsed = 0;
  }

  create(): void {
    const payload = this.registry.get('payload') as GamePayload;
    const district = payload.districts.find((d) => d.id === this.init_.districtId);
    const level = district?.levels[this.init_.levelIndex];
    if (!district || !level) throw new Error(`No level ${this.init_.levelIndex} in district "${this.init_.districtId}"`);
    const layout = (this.layout = getLayout(level.layout));

    createTextures(this);
    this.backdrop = createBackdrop(this);
    this.physics.world.setBounds(0, 0, layout.width, layout.height + 400);
    this.physics.world.setBoundsCollision(true, true, false, false);

    const solids = this.buildPlatforms();
    this.buildExit();
    this.buildGates();

    const keyboard = keyboardControls(this);
    const touch = this.registry.get('touch') as ControlSource | undefined;
    this.max = new Max(this, layout.start.x, layout.start.y - 40, touch ? [keyboard, touch] : [keyboard]);
    this.max.setDepth(5);
    this.physics.add.collider(this.max, solids);
    this.physics.add.collider(this.max, this.movers.map((m) => m.image));
    this.physics.add.collider(this.max, this.gates.map((g) => g.blocker));

    const cam = this.cameras.main;
    cam.setBounds(0, 0, layout.width, layout.height);
    cam.startFollow(this.max, true, 0.1, 0.1);
    cam.setFollowOffset(-140, 0);

    this.sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 80, max: 260 },
      lifespan: 600,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [hex(PALETTE.cyan), hex(PALETTE.pink), hex(PALETTE.gold)],
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(6);
    this.max.on('land', (speed: number) => this.burst(this.max.x, this.max.body.bottom, Math.min(12, Math.round(speed / 80))));
    this.max.on('jump', () => this.burst(this.max.x, this.max.body.bottom, 5));

    this.buildHud(district.title, level.title);
    this.wireEvents(keyboard);
  }

  // ------------------------------------------------------------ building

  private buildPlatforms(): Phaser.GameObjects.Zone[] {
    const solids: Phaser.GameObjects.Zone[] = [];
    for (const p of this.layout.platforms) {
      const key = platformTexture(this, p.w, p.h);
      if (p.moving) {
        const img = this.physics.add.image(p.x + p.w / 2, p.y - PLATFORM_GLOW + (p.h + PLATFORM_GLOW) / 2, key);
        img.body.setSize(p.w, p.h, false).setOffset(0, PLATFORM_GLOW);
        img.body.setAllowGravity(false).setImmovable(true);
        this.movers.push({ image: img, base: { x: img.x, y: img.y }, move: p.moving });
      } else {
        this.add.image(p.x, p.y - PLATFORM_GLOW, key).setOrigin(0);
        const zone = this.add.zone(p.x + p.w / 2, p.y + p.h / 2, p.w, p.h);
        this.physics.add.existing(zone, true);
        solids.push(zone);
      }
    }
    return solids;
  }

  private groundY(x: number): number {
    const under = this.layout.platforms.filter((p) => !p.moving && x >= p.x && x <= p.x + p.w);
    return under.length ? Math.max(...under.map((p) => p.y)) : this.layout.start.y + 80;
  }

  private buildGates(): void {
    this.layout.gates.forEach(({ x }, i) => {
      const ground = this.groundY(x);
      const image = this.add.image(x, ground + 2, 'gate-locked').setOrigin(0.5, 1).setDepth(2);
      const label = this.add.text(x, ground - GATE_SIZE.h - 14, `GATE_0${i + 1}`, {
        fontFamily: HUD_FONT, fontSize: '20px', fontStyle: 'bold', color: PALETTE.cyan,
      }).setOrigin(0.5, 1).setDepth(2);
      const mark = this.add.text(x, ground - 70, '', {
        fontFamily: HUD_FONT, fontSize: '56px', fontStyle: 'bold', color: PALETTE.pink,
      }).setOrigin(0.5).setDepth(3);
      const blocker = this.add.zone(x, ground - GATE_BODY.h / 2, GATE_BODY.w, GATE_BODY.h);
      this.physics.add.existing(blocker, true);
      this.gates.push({ x, image, label, mark, blocker, reached: false });
    });
    this.refreshGates();
  }

  private refreshGates(): void {
    this.gates.forEach((g, i) => {
      const state = i < this.opened ? 'cleared' : i === this.opened ? 'active' : 'locked';
      g.image.setTexture(`gate-${state}`);
      g.mark.setText(state === 'active' ? '?' : state === 'cleared' ? '[OK]' : '');
      g.mark.setFontSize(state === 'cleared' ? 26 : 56).setY(state === 'cleared' ? g.label.y - 44 : this.groundY(g.x) - 70);
      g.mark.setColor(state === 'cleared' ? PALETTE.green : PALETTE.pink);
      g.label.setColor(state === 'locked' ? '#8e82b3' : state === 'cleared' ? PALETTE.green : PALETTE.cyan);
      g.label.setText(state === 'locked' ? `GATE_0${i + 1} // LOCKED` : `GATE_0${i + 1}`);
    });
    if (!this.reducedMotion) {
      const active = this.gates[this.opened];
      this.tweens.killTweensOf(this.gates.map((g) => g.mark));
      this.gates.forEach((g) => g.mark.setScale(1));
      if (active) this.tweens.add({ targets: active.mark, scale: 1.12, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  private buildExit(): void {
    const { x } = this.layout.exit;
    const ground = this.groundY(x);
    const portal = this.add.image(x, ground - 4, 'portal').setOrigin(0.5, 1).setDepth(2);
    this.add.text(x, ground - 176, 'EXIT', {
      fontFamily: HUD_FONT, fontSize: '22px', fontStyle: 'bold', color: PALETTE.gold,
    }).setOrigin(0.5, 1);
    if (!this.reducedMotion) {
      this.tweens.add({ targets: portal, scaleX: 1.08, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  /** The HUD is an HTML bar above the canvas (src/game/ui/hud.ts), so it stays readable on phones. */
  private buildHud(districtTitle: string, levelTitle: string): void {
    this.hud = this.registry.get('hud') as Hud | undefined;
    this.hud?.setLevel(`${districtTitle.toUpperCase()} // LVL_0${this.init_.levelIndex + 1}`, levelTitle);
    this.updateGateHud();
  }

  private updateGateHud(): void {
    this.hud?.setGates(this.opened, this.gates.length);
  }

  private wireEvents(keyboard: { destroy(): void }): void {
    const onGateOpened = (index?: number) => this.openGate(index ?? this.opened);
    this.events.on('gate-opened', onGateOpened);

    const onVisibility = () => {
      if (document.hidden && this.scene.isActive()) {
        this.input.keyboard?.resetKeys();
        this.scene.pause();
        this.pausedByVisibility = true;
      } else if (!document.hidden && this.pausedByVisibility) {
        this.pausedByVisibility = false;
        this.scene.resume();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Dev-only shortcut until Task 5 wires the gate challenges: O opens the reached gate.
    if (import.meta.env.DEV) {
      this.input.keyboard?.on('keydown-O', () => {
        if (this.gates[this.opened]?.reached) this.events.emit('gate-opened', this.opened);
      });
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onVisibility);
      this.events.off('gate-opened', onGateOpened);
      keyboard.destroy();
    });
  }

  // ------------------------------------------------------------ play

  private openGate(index: number): void {
    const gate = this.gates[index];
    if (!gate || index !== this.opened) return;
    (gate.blocker.body as Phaser.Physics.Arcade.StaticBody).enable = false;
    this.opened++;
    this.refreshGates();
    this.updateGateHud();
    this.burst(gate.x, this.groundY(gate.x) - 100, 24);
    if (!this.reducedMotion) this.cameras.main.shake(140, 0.004);
  }

  private respawn(): void {
    const x = this.opened > 0 ? this.gates[this.opened - 1].x : this.layout.start.x;
    this.max.placeAt(x, this.groundY(x) - 40);
    this.max.setAlpha(0.2);
    this.tweens.add({ targets: this.max, alpha: 1, duration: 450 });
    this.cameras.main.centerOn(x + 140, this.cameras.main.midPoint.y);
  }

  private burst(x: number, y: number, count: number): void {
    if (this.reducedMotion || count <= 0) return;
    this.sparks.explode(count, x, y);
  }

  private moveMovers(delta: number): void {
    for (const m of this.movers) {
      const phase = (1 - Math.cos((2 * Math.PI * this.elapsed) / m.move.periodMs)) / 2;
      const tx = m.base.x + m.move.dx * phase;
      const ty = m.base.y + m.move.dy * phase;
      const s = delta / 1000;
      (m.image.body as Phaser.Physics.Arcade.Body).setVelocity((tx - m.image.x) / s, (ty - m.image.y) / s);
    }
  }

  private trail(time: number): void {
    if (this.reducedMotion || this.max.onGround || time - this.lastTrail < 45) return;
    this.lastTrail = time;
    const ghost = this.add.image(this.max.x, this.max.y, this.max.texture.key)
      .setFlipX(this.max.flipX).setTint(hex(PALETTE.cyan)).setAlpha(0.35).setDepth(4);
    this.tweens.add({ targets: ghost, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 50);
    this.elapsed += dt;
    this.moveMovers(dt);
    this.max.tick(time, dt);
    this.trail(time);
    this.backdrop.update(this.cameras.main.scrollX);

    const gate = this.gates[this.opened];
    if (gate && !gate.reached && this.max.body.right >= gate.x - GATE_BODY.w / 2 - 6) {
      gate.reached = true;
      this.events.emit('gate-reached', this.opened);
    }

    if (this.max.y > this.layout.height + 100) this.respawn();

    if (!this.exited && this.opened === this.gates.length && this.max.x >= this.layout.exit.x - 10) {
      this.exited = true;
      this.max.frozen = true;
      this.burst(this.layout.exit.x, this.max.y, 30);
      this.tweens.add({ targets: this.max, alpha: 0, duration: 400 });
      this.events.emit('level-exit');
    }
  }
}

