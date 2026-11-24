// One gate round as pure state: which content round is shown, in what order, and what a
// choice means. Locks after the first choice so a double key-press or double tap counts
// once (Review Focus 4). Over-suspicious keeps the same round, so the caller unlocks it.
import type { GateData, TrustOrReportRound } from '../types';
import { judgePortal, judgeTrust, pickRoundIndex, shuffled } from './rounds';

export type GateOutcome =
  | { kind: 'pass' }
  | { kind: 'caught'; redFlag: string }
  | { kind: 'over-suspicious'; note: string };

export interface GateChoice {
  label: string;
  /** Decorative symbol shown before the label (not read out). */
  icon?: string;
}

export interface GateRoundView {
  type: GateData['type'];
  prompt: string;
  item?: TrustOrReportRound['item'];
  choices: GateChoice[];
}

/** Shown when a content string is unexpectedly empty, so the screen is never blank. */
export const FALLBACK_RED_FLAG = 'That one was a trick. Look closely at every detail before you choose.';
export const FALLBACK_NOTE = 'This one was actually safe. Being careful is great, so keep checking the details.';

const TRUST_CHOICES: GateChoice[] = [
  { label: 'TRUST', icon: '✔' },
  { label: 'REPORT', icon: '⚑' },
];

const orFallback = (text: string, fallback: string) => (text.trim() ? text : fallback);

export class GateRound {
  readonly index: number;
  readonly view: GateRoundView;
  /** Screen position -> option index in the content round (choose-portal only). */
  private readonly order: number[];
  private locked = false;

  constructor(private readonly gate: GateData, previous: number | null, rng: () => number) {
    this.index = pickRoundIndex(gate.rounds.length, previous, rng);
    if (gate.type === 'choose-portal') {
      const round = gate.rounds[this.index];
      this.order = shuffled(round.options.map((_, i) => i), rng);
      this.view = {
        type: gate.type,
        prompt: round.prompt,
        choices: this.order.map((i) => ({ label: round.options[i].label })),
      };
    } else {
      const round = gate.rounds[this.index];
      this.order = [0, 1];
      this.view = { type: gate.type, prompt: round.prompt, item: round.item, choices: TRUST_CHOICES };
    }
  }

  get isLocked(): boolean {
    return this.locked;
  }

  /** Judge the choice at screen `position`; null while locked or out of range. */
  choose(position: number): GateOutcome | null {
    if (this.locked || !Number.isInteger(position) || position < 0 || position >= this.view.choices.length) return null;
    this.locked = true;
    if (this.gate.type === 'choose-portal') {
      const r = judgePortal(this.gate.rounds[this.index], this.order[position]);
      return r.correct ? { kind: 'pass' } : { kind: 'caught', redFlag: orFallback(r.redFlag, FALLBACK_RED_FLAG) };
    }
    const r = judgeTrust(this.gate.rounds[this.index], position === 0 ? 'trust' : 'report');
    if (r.outcome === 'pass') return { kind: 'pass' };
    if (r.outcome === 'caught') return { kind: 'caught', redFlag: orFallback(r.redFlag, FALLBACK_RED_FLAG) };
    return { kind: 'over-suspicious', note: orFallback(r.note, FALLBACK_NOTE) };
  }

  /** After the over-suspicious note: the same round stays, ready for another choice. */
  unlock(): void {
    this.locked = false;
  }
}
