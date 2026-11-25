// The PHISH.BOT boss fight (spec §6.6): the habit practised at speed. PHISH.BOT (right)
// sends message cards that drift to Max (left). For each card nearest Max the player picks
// 🛡 SHIELD or ✔ LET IT THROUGH (HTML panel below the canvas, keys S/← and L/→).
// The rules live in logic/boss.ts; this scene runs the clock, the waves and the effects.
//
// Everything runs on a fight clock advanced in update(), so the fight is frozen (no card
// moves, no timer advances) while it is not running: before the start, behind a reading
// screen (Caught, stash, Scam Files), and while the tab is hidden.
// A card that reaches Max undecided gets through (as if let through).
// Started with { districtId }. Caught restarts the scene from createBoss.
import Phaser from 'phaser';
import { createBackdrop, HORIZON } from '../art/backdrop';
import { HUD_FONT, PALETTE, TONES, hex } from '../art/palette';
import { createTextures } from '../art/textures';
import { advanceWave, BOSS_TIMING, createBoss, messageId, resolveMessage, type BossAction, type BossState } from '../logic/boss';
import { FALLBACK_RED_FLAG } from '../logic/gate-round';
import { recordBoss } from '../logic/progress';
import { shuffled } from '../logic/rounds';
import { revealableFiles } from '../logic/unlocks';
import type { Shell } from '../shell';
import type { BossMessage, DistrictData } from '../types';
import { mountBossPanel, type BossPanel } from '../ui/boss-panel';
import type { GameFocus } from '../ui/game-focus';
import type { Hud } from '../ui/hud';
import { CardStream, READ_FONT, type FlyingCard } from './boss-cards';

export interface BossInit {
  districtId: string;
  reducedMotion?: boolean;
}

/** Before the first card: PHISH.BOT's intro line is on screen. */
const INTRO_MS = 2500;
/** Pause between waves (the "WAVE 2" banner). */
const WAVE_GAP_MS = 1500;
const NEXT_DISTRICT = 'Password Tower';

const MAX_POS = { x: 170, y: 650 };
const BOT_POS = { x: 1130, y: 650 };
/** The shield is an arc of this circle in front of Max; cards end at its face. */
const SHIELD_C = { x: 180, y: 470 };
const SHIELD_R = 200;
const SHIELD_X = 300;

interface Queued {
  msg: BossMessage;
  index: number;
}

export class BossScene extends Phaser.Scene {
  private init_!: BossInit;
  private shell!: Shell;
  private district!: DistrictData;
  private reduced = false;
  /** Slower everything with reduced motion (BOSS_TIMING.reducedMotionFactor). */
  private factor = 1;
  private state!: BossState;
  private loop = 0;
  private queue: Queued[] = [];
  /** Messages of the current wave not resolved yet (queued or in flight). */
  private waveLeft = 0;
  private fightTime = 0;
  private nextSpawnAt = 0;
  private frozen = false;
  private pausedByVisibility = false;
  private cards!: CardStream;
  private panel?: BossPanel;
  private hud?: Hud;

  private maxImg!: Phaser.GameObjects.Image;
  private bot!: Phaser.GameObjects.Image;
  private shieldGfx!: Phaser.GameObjects.Graphics;
  private healthFill!: Phaser.GameObjects.Rectangle;
  private healthText!: Phaser.GameObjects.Text;
  private shieldText!: Phaser.GameObjects.Text;
  private pips: Phaser.GameObjects.Arc[] = [];
  private waveText!: Phaser.GameObjects.Text;
  private bubble?: Phaser.GameObjects.Container;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('boss');
  }

  init(data: BossInit): void {
    this.init_ = data;
    this.shell = this.registry.get('shell') as Shell;
    this.reduced = data.reducedMotion ?? this.shell.reducedMotion();
    this.factor = this.reduced ? BOSS_TIMING.reducedMotionFactor : 1;
    this.loop = 0;
    this.queue = [];
    this.waveLeft = 0;
    this.fightTime = 0;
    this.frozen = false;
    this.pausedByVisibility = false;
    this.pips = [];
    this.panel = undefined;
    this.bubble = undefined;
  }

  create(): void {
    const district = this.shell.payload.districts.find((d) => d.id === this.init_.districtId);
    if (!district) throw new Error(`No district "${this.init_.districtId}"`);
    this.district = district;
    // A restart after Caught may follow a freeze: start with clocks running.
    this.time.paused = false;
    this.tweens.resumeAll();

    createTextures(this);
    createBackdrop(this).update(0);
    this.buildStage();
    this.cards = new CardStream(this, BOSS_TIMING.travelMs * this.factor);
    this.state = createBoss(district.boss);
    this.startWave(0);
    this.nextSpawnAt = INTRO_MS * this.factor;

    this.buildPanel();
    this.refreshMeters();
    this.shell.announce(`Boss fight! ${district.boss.name} says: ${district.boss.intro} Fake message? Shield it. Real message? Let it through.`);
    this.wireEvents();
  }

  // ------------------------------------------------------------ building

  private buildStage(): void {
    const boss = this.district.boss;
    this.add.rectangle(0, HORIZON, 1280, 720 - HORIZON, hex(PALETTE.bg0), 0.35).setOrigin(0);

    // Max on the left behind his shield.
    this.maxImg = this.add.image(MAX_POS.x, MAX_POS.y, 'max-idle').setOrigin(0.5, 1).setScale(2.2).setDepth(4);
    this.shieldGfx = this.add.graphics().setDepth(5);

    // PHISH.BOT on the right.
    this.bot = this.add.image(BOT_POS.x, BOT_POS.y, 'phishbot').setOrigin(0.5, 1).setScale(1.8).setDepth(4);
    if (!this.reduced) {
      this.tweens.add({ targets: this.bot, y: BOT_POS.y - 10, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    // Top left: Max's shield (pips plus text). Top right: PHISH.BOT's health (bar plus text).
    const label = { fontFamily: HUD_FONT, fontSize: '24px', fontStyle: 'bold' };
    this.shieldText = this.add.text(40, 28, '', { ...label, color: PALETTE.cyan }).setDepth(20);
    for (let i = 0; i < BOSS_TIMING.maxHits; i++) {
      this.pips.push(this.add.circle(52 + i * 34, 80, 12, hex(PALETTE.cyan)).setStrokeStyle(3, hex(PALETTE.cyan)).setDepth(20));
    }
    this.healthText = this.add.text(1240, 28, '', { ...label, color: PALETTE.pink }).setOrigin(1, 0).setDepth(20);
    this.add.rectangle(1240, 80, 320, 22, hex(TONES.floor)).setOrigin(1, 0.5).setStrokeStyle(2, hex(PALETTE.pink)).setDepth(20);
    this.healthFill = this.add.rectangle(1240 - 318, 80, 316, 18, hex(PALETTE.pink)).setOrigin(0, 0.5).setDepth(21);
    this.waveText = this.add.text(640, 28, '', { ...label, color: PALETTE.gold }).setOrigin(0.5, 0).setDepth(20);

    // PHISH.BOT's intro line until the first card.
    const intro = this.add.text(0, 0, `${boss.name}: ${boss.intro}`, {
      fontFamily: READ_FONT, fontSize: '26px', color: TONES.text, align: 'center', wordWrap: { width: 560, useAdvancedWrap: true },
    }).setOrigin(0.5);
    const frame = this.add.rectangle(0, 0, intro.width + 40, intro.height + 28, hex('#12020e'), 0.95).setStrokeStyle(3, hex(PALETTE.danger));
    this.bubble = this.add.container(820, 250, [frame, intro]).setDepth(15);

    this.sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 100, max: 300 }, lifespan: 600, scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 },
      tint: [hex(PALETTE.cyan), hex(PALETTE.pink), hex(PALETTE.gold)], blendMode: 'ADD', emitting: false,
    }).setDepth(25);
  }

  /** The energy shield: fainter and more cracked with every hit. */
  private drawShield(): void {
    const g = this.shieldGfx;
    const hits = this.state.hits;
    const strength = 1 - hits / (BOSS_TIMING.maxHits + 1);
    g.clear();
    for (const [w, a] of [[14, 0.08], [8, 0.16], [4, 0.9]] as const) {
      g.lineStyle(w, hex(PALETTE.cyan), a * strength);
      g.beginPath();
      g.arc(SHIELD_C.x, SHIELD_C.y, SHIELD_R, -0.95, 0.95, false);
      g.strokePath();
    }
    // Cracks: one jagged line across the shield per hit taken.
    g.lineStyle(3, hex(TONES.text), 0.9);
    [-0.55, 0.45, -0.05].slice(0, hits).forEach((a) => {
      const pts = [0, 1, 2, 3].map((k) => {
        const angle = a + (k - 1.5) * 0.05;
        const r = SHIELD_R + (k % 2 ? 16 : -16);
        return new Phaser.Math.Vector2(SHIELD_C.x + r * Math.cos(angle), SHIELD_C.y + r * Math.sin(angle));
      });
      g.strokePoints(pts, false);
    });
  }

  private buildPanel(): void {
    const { stage } = this.shell.host;
    const root = (stage.closest('[data-game-root]') as HTMLElement | null) ?? stage.parentElement ?? stage;
    const focus = this.registry.get('focus') as GameFocus | undefined;
    // The platform pad (◀ ▶ JUMP) has no use here; the panel's big buttons replace it.
    const touchEl = root.querySelector<HTMLElement>('[data-game-touch]');
    const touchWasShown = touchEl ? !touchEl.hidden : false;
    if (touchEl) touchEl.hidden = true;
    const panel = mountBossPanel(root, stage, {
      intro: `${this.district.boss.name}: ${this.district.boss.intro}`,
      keysActive: () => focus?.isActive() ?? true,
      onChoose: (choice) => this.act(choice),
    });
    this.panel = {
      ...panel,
      destroy: () => {
        panel.destroy();
        if (touchEl && touchWasShown) touchEl.hidden = false;
      },
    };
    this.hud = this.registry.get('hud') as Hud | undefined;
    this.hud?.setLevel(`${this.district.title.toUpperCase()} // BOSS`, this.district.boss.name);
  }

  private refreshMeters(): void {
    const s = this.state;
    const name = this.district.boss.name;
    const shield = BOSS_TIMING.maxHits - s.hits;
    this.healthText.setText(`${name} ${s.health}/${s.maxHealth}`);
    this.healthFill.width = 316 * Math.max(0, s.health / s.maxHealth);
    this.shieldText.setText(`SHIELD ${shield}/${BOSS_TIMING.maxHits}`);
    this.pips.forEach((p, i) => p.setFillStyle(hex(PALETTE.cyan), i < shield ? 1 : 0));
    const wave = this.loop > 0 ? 'FINAL WAVE' : `WAVE ${s.wave + 1}/3`;
    this.waveText.setText(wave);
    this.drawShield();
    this.hud?.setMeter(
      `${name} ${s.health}/${s.maxHealth} · SHIELD ${shield}/${BOSS_TIMING.maxHits}`,
      `${name} health ${s.health} of ${s.maxHealth}. Max's shield ${shield} of ${BOSS_TIMING.maxHits}.`,
    );
  }

  private wireEvents(): void {
    const onVisibility = () => {
      if (document.hidden && this.scene.isActive()) {
        this.scene.pause();
        this.pausedByVisibility = true;
      } else if (!document.hidden && this.pausedByVisibility) {
        this.pausedByVisibility = false;
        this.scene.resume();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // DOM listeners and the panel must go on shutdown (retry, leaving) and on destroy.
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.removeEventListener('visibilitychange', onVisibility);
      this.panel?.destroy();
      this.panel = undefined;
      this.time.removeAllEvents();
      this.tweens.killAll();
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  // ------------------------------------------------------------ waves

  private startWave(wave: 0 | 1 | 2): void {
    const messages = this.district.boss.waves[wave]?.messages ?? [];
    const list = messages.map((msg, index) => ({ msg, index }));
    // Waves 1-3 in content order; after that the last wave repeats, shuffled.
    this.queue = this.loop > 0 ? shuffled(list, Math.random) : list;
    this.waveLeft = this.queue.length;
  }

  private nextWave(): void {
    if (this.state.wave < 2) this.state = advanceWave(this.state);
    else this.loop += 1;
    this.startWave(this.state.wave);
    if (this.waveLeft === 0) return;
    this.nextSpawnAt = this.fightTime + WAVE_GAP_MS * this.factor;
    this.refreshMeters();
    this.banner(this.loop > 0 ? 'FINAL WAVE: AGAIN!' : `WAVE ${this.state.wave + 1}`);
  }

  private spawn(): void {
    const next = this.queue.shift();
    if (!next) return;
    if (this.bubble) {
      const bubble = this.bubble;
      this.bubble = undefined;
      this.tweens.add({ targets: bubble, alpha: 0, duration: 300, onComplete: () => bubble.destroy() });
    }
    this.cards.spawn(messageId(this.state.wave, next.index, this.loop), next.msg, this.fightTime);
    this.nextSpawnAt = this.fightTime + BOSS_TIMING.spawnEveryMs[this.state.wave] * this.factor;
  }

  update(_time: number, delta: number): void {
    if (this.frozen || this.state.status !== 'fighting') return;
    this.fightTime += Math.min(delta, BOSS_TIMING.maxStepMs);
    if (this.queue.length > 0 && this.fightTime >= this.nextSpawnAt) this.spawn();
    // A card that reaches Max undecided gets through, as if let through.
    for (const card of this.cards.step(this.fightTime)) {
      if (this.state.status === 'fighting') this.resolve(card, 'pass');
    }
    if (this.state.status !== 'fighting') return;
    const { changed, card } = this.cards.refreshCurrent();
    if (changed) {
      this.panel?.setCurrent(card ? card.msg.text : null);
      if (card) this.shell.announce(`Message: ${card.msg.text}`);
    }
    if (this.waveLeft === 0) this.nextWave();
  }

  // ------------------------------------------------------------ decisions

  private act(action: BossAction): void {
    if (this.frozen || this.state.status !== 'fighting') return;
    const card = this.cards.current();
    if (card) this.resolve(card, action);
  }

  private resolve(card: FlyingCard, action: BossAction): void {
    const { state, event } = resolveMessage(this.state, card.id, card.msg, action);
    if (event === 'ignored') return;
    this.state = state;
    this.waveLeft -= 1;
    this.cards.release(card);
    this.refreshMeters();

    if (event === 'damage') this.reflect(card);
    else if (event === 'hit') this.hitMax(card);
    else if (event === 'bonus') this.absorb(card);
    else this.realNote(card);

    if (state.status === 'won') void this.win();
    else if (state.status === 'caught') void this.caught(card.msg);
  }

  /** Shielded fake: the card bounces back and sparks fly off the bot. */
  private reflect(card: FlyingCard): void {
    this.shell.sfx('damage');
    this.shell.announce(`Blocked! ${this.district.boss.name} ${this.state.health} of ${this.state.maxHealth}.`);
    this.floatText(card.box.x, card.box.y - 70, '🛡 BLOCKED!', PALETTE.cyan);
    card.frame.setStrokeStyle(5, hex(PALETTE.cyan));
    this.tweens.add({
      targets: card.box, x: BOT_POS.x - 40, y: BOT_POS.y - 160, scale: 0.3, alpha: 0.2, duration: 380 * this.factor, ease: 'Quad.in',
      onComplete: () => {
        card.box.destroy();
        if (!this.reduced) this.sparks.explode(26, BOT_POS.x - 30, BOT_POS.y - 160);
        // One short gold tint on the bot (a single flash).
        this.bot.setTint(hex(PALETTE.gold));
        this.time.delayedCall(160, () => this.bot.clearTint());
        this.floatText(BOT_POS.x - 40, BOT_POS.y - 300, '-1', PALETTE.pink);
      },
    });
  }

  /** Fake let through: it hits Max's shield, which cracks. */
  private hitMax(card: FlyingCard): void {
    this.shell.sfx('hit');
    const left = BOSS_TIMING.maxHits - this.state.hits;
    this.shell.announce(`Oops, that one was fake! Shield ${left} of ${BOSS_TIMING.maxHits}.`);
    card.frame.setStrokeStyle(5, hex(PALETTE.danger));
    this.floatText(SHIELD_X + 40, card.box.y - 70, `✖ FAKE! SHIELD ${left}/${BOSS_TIMING.maxHits}`, PALETTE.danger);
    this.tweens.add({
      targets: card.box, x: SHIELD_X, alpha: 0, scale: 0.7, duration: 250 * this.factor,
      onComplete: () => card.box.destroy(),
    });
    if (!this.reduced) this.cameras.main.shake(180, 0.006);
  }

  /** Real message let through: Max keeps it and a shield pip comes back. */
  private absorb(card: FlyingCard): void {
    this.shell.sfx('gate');
    const left = BOSS_TIMING.maxHits - this.state.hits;
    this.shell.announce(`Real message, nice! Shield ${left} of ${BOSS_TIMING.maxHits}.`);
    card.frame.setStrokeStyle(5, hex(PALETTE.green));
    this.floatText(SHIELD_X + 60, card.box.y - 70, '✔ REAL! +1 SHIELD', PALETTE.green);
    this.tweens.add({
      targets: card.box, x: MAX_POS.x, y: MAX_POS.y - 100, scale: 0.2, alpha: 0, duration: 350 * this.factor,
      onComplete: () => card.box.destroy(),
    });
  }

  /** Real message shielded: a gentle note, no damage and no pause. */
  private realNote(card: FlyingCard): void {
    this.shell.sfx('click');
    this.panel?.toast('That one was real');
    this.shell.announce('That one was real.');
    this.floatText(card.box.x, card.box.y - 70, 'That one was real', PALETTE.gold);
    this.tweens.add({ targets: card.box, alpha: 0, duration: 400 * this.factor, onComplete: () => card.box.destroy() });
  }

  // ------------------------------------------------------------ endings

  /** Freeze the fight (no cards, timers or tweens advance) behind a reading screen. */
  private freeze(on: boolean): void {
    this.frozen = on;
    this.panel?.setBusy(on || this.state.status !== 'fighting');
    this.time.paused = on;
    if (on) this.tweens.pauseAll();
    else this.tweens.resumeAll();
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }

  private alive(): boolean {
    return this.sys.isActive() || this.sys.isPaused();
  }

  private async caught(msg: BossMessage): Promise<void> {
    this.panel?.setBusy(true);
    this.panel?.setCurrent(null);
    this.cards.clear(!this.reduced);
    this.shell.sfx('caught');
    // A cartoon data cage drops over Max. Never scary.
    this.maxImg.setTint(hex(PALETTE.danger));
    const cage = this.add.image(MAX_POS.x, MAX_POS.y + 6, 'cage').setOrigin(0.5, 1).setScale(2.2).setDepth(6);
    if (!this.reduced) {
      cage.y -= 200;
      this.tweens.add({ targets: cage, y: MAX_POS.y + 6, duration: 320, ease: 'Bounce.out' });
    }
    await this.wait(this.reduced ? 500 : 1000);
    if (!this.alive()) return;
    this.freeze(true);
    await this.shell.showCaught({ botName: this.district.boss.name, redFlag: msg.redFlag?.trim() ? msg.redFlag : FALLBACK_RED_FLAG, retryLabel: 'RETRY BOSS' });
    if (!this.alive()) return;
    this.scene.restart({ districtId: this.district.id });
  }

  private async win(): Promise<void> {
    // Save the win (and its files) first, so leaving for the map mid-animation keeps it.
    const d = this.district;
    const files = revealableFiles(d.scamFileRewards, this.shell.payload.scamFiles);
    this.shell.update((p) => recordBoss(p, d.id, files.map((f) => f.id)));
    this.panel?.setBusy(true);
    this.panel?.setCurrent(null);
    this.cards.clear(!this.reduced);
    this.shell.announce(`${this.district.boss.name} crashed! You beat it!`);
    await this.wait(420 * this.factor);
    if (!this.alive()) return;
    await this.glitchOut();
    if (!this.alive()) return;

    this.shell.sfx('clear');
    this.freeze(true);
    await this.shell.showStash(files, NEXT_DISTRICT);
    if (!this.alive()) return;
    this.shell.openMap();
  }

  /** PHISH.BOT glitches out and crashes: at most 2.5 flashes per second, none with reduced motion. */
  private async glitchOut(): Promise<void> {
    this.tweens.killTweensOf(this.bot);
    this.add.text(BOT_POS.x - 60, 150, 'SYSTEM ERROR :(', {
      fontFamily: HUD_FONT, fontSize: '30px', fontStyle: 'bold', color: PALETTE.gold,
    }).setOrigin(0.5).setDepth(20);
    if (this.reduced) {
      this.tweens.add({ targets: this.bot, alpha: 0, angle: 12, duration: 1200 });
      await this.wait(1300);
      return;
    }
    // Each flash is a 400 ms dim-and-back cycle: 2.5 per second, under the 3 per second limit.
    this.tweens.add({ targets: this.bot, alpha: 0.25, x: BOT_POS.x + 8, duration: 200, yoyo: true, repeat: 2 });
    await this.wait(1200);
    if (!this.alive()) return;
    this.sparks.explode(40, BOT_POS.x, BOT_POS.y - 120);
    this.tweens.add({ targets: this.bot, y: BOT_POS.y + 60, angle: 25, alpha: 0, duration: 700, ease: 'Quad.in' });
    await this.wait(800);
  }

  // ------------------------------------------------------------ helpers

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, {
      fontFamily: HUD_FONT, fontSize: '26px', fontStyle: 'bold', color, stroke: PALETTE.bg0, strokeThickness: 5,
    }).setOrigin(0.5).setDepth(22);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, delay: 500 * this.factor, duration: 700 * this.factor, onComplete: () => t.destroy() });
  }

  private banner(text: string): void {
    const t = this.add.text(640, 200, text, {
      fontFamily: HUD_FONT, fontSize: '48px', fontStyle: 'bold', color: PALETTE.gold, stroke: PALETTE.bg0, strokeThickness: 6,
    }).setOrigin(0.5).setDepth(22).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 250, yoyo: true, hold: 900 * this.factor, onComplete: () => t.destroy() });
    this.shell.announce(text);
  }
}
