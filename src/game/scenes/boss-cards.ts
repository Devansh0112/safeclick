// PHISH.BOT's message cards on the canvas. Cards leave the bot and drift to Max's shield
// over `travelMs`, in two alternating lanes so they never overlap. Positions come from the
// fight clock the scene passes in (not tweens), so freezing the fight freezes the cards.
// The unresolved card nearest Max is "current": gold frame and a "▶ NOW" tag (not colour alone).
import Phaser from 'phaser';
import { HUD_FONT, PALETTE, TONES, hex } from '../art/palette';
import type { BossMessage } from '../types';

export const READ_FONT = '"Atkinson Hyperlegible", system-ui, sans-serif';
export const CARD_W = 340;
/** Card centre x when it leaves the bot and when it meets Max's shield. */
export const CARD_PATH = { fromX: 960, toX: 480, lanes: [320, 480] } as const;
const DEPTH = 10;

export interface FlyingCard {
  id: string;
  msg: BossMessage;
  /** Fight time (ms) when it left the bot. */
  spawnAt: number;
  box: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Rectangle;
  resolved: boolean;
}

export class CardStream {
  private cards: FlyingCard[] = [];
  private lane = 0;
  private currentId: string | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly travelMs: number,
  ) {}

  spawn(id: string, msg: BossMessage, now: number): FlyingCard {
    const { scene } = this;
    const y = CARD_PATH.lanes[this.lane];
    this.lane = (this.lane + 1) % CARD_PATH.lanes.length;
    const text = scene.add.text(-CARD_W / 2 + 54, 0, msg.text, {
      fontFamily: READ_FONT, fontSize: '24px', color: TONES.text, wordWrap: { width: CARD_W - 74, useAdvancedWrap: true },
    }).setOrigin(0, 0.5);
    const h = Math.max(84, text.height + 30);
    const frame = scene.add.rectangle(0, 0, CARD_W, h, hex('#0e1240'), 0.96).setStrokeStyle(3, hex(PALETTE.cyan));
    const icon = scene.add.text(-CARD_W / 2 + 28, 0, '💬', { fontFamily: READ_FONT, fontSize: '28px' }).setOrigin(0.5);
    const tag = scene.add.text(-CARD_W / 2, -h / 2 - 6, '▶ NOW', {
      fontFamily: HUD_FONT, fontSize: '20px', fontStyle: 'bold', color: PALETTE.gold,
    }).setOrigin(0, 1).setVisible(false).setName('tag');
    const box = scene.add.container(CARD_PATH.fromX, y, [frame, icon, text, tag]).setDepth(DEPTH).setSize(CARD_W, h);
    const card: FlyingCard = { id, msg, spawnAt: now, box, frame, resolved: false };
    this.cards.push(card);
    return card;
  }

  /** Move cards to fight time `now`. Returns unresolved cards that reached Max. */
  step(now: number): FlyingCard[] {
    const arrived: FlyingCard[] = [];
    for (const c of this.cards) {
      if (c.resolved) continue;
      const t = Math.min(1, (now - c.spawnAt) / this.travelMs);
      c.box.x = CARD_PATH.fromX + (CARD_PATH.toX - CARD_PATH.fromX) * t;
      // Fade in over the first few frames only; the text is readable from the start.
      c.box.alpha = Math.min(1, 0.4 + t * 12);
      if (t >= 1) arrived.push(c);
    }
    return arrived;
  }

  /** The unresolved card nearest Max (the oldest one, since all move at the same speed). */
  current(): FlyingCard | undefined {
    return this.cards.find((c) => !c.resolved);
  }

  /** Re-mark the current card if it changed; returns whether it did and the current card. */
  refreshCurrent(): { changed: boolean; card?: FlyingCard } {
    const card = this.current();
    const id = card?.id ?? null;
    if (id === this.currentId) return { changed: false, card };
    this.currentId = id;
    for (const c of this.cards) {
      const on = c === card;
      c.frame.setStrokeStyle(on ? 5 : 3, hex(on ? PALETTE.gold : PALETTE.cyan));
      (c.box.getByName('tag') as Phaser.GameObjects.Text | null)?.setVisible(on);
    }
    return { changed: true, card };
  }

  /** Take a resolved card out of the stream; the caller animates and destroys it. */
  release(card: FlyingCard): void {
    card.resolved = true;
    this.cards = this.cards.filter((c) => c !== card);
    (card.box.getByName('tag') as Phaser.GameObjects.Text | null)?.setVisible(false);
  }

  /** Remove every card still in flight (fight over). */
  clear(fade: boolean): void {
    for (const c of this.cards) {
      if (fade) this.scene.tweens.add({ targets: c.box, alpha: 0, duration: 300, onComplete: () => c.box.destroy() });
      else c.box.destroy();
    }
    this.cards = [];
    this.currentId = null;
  }
}
