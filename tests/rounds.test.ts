import { describe, expect, it } from 'vitest';
import { judgePortal, judgeTrust, pickRoundIndex, shuffled } from '../src/game/logic/rounds';
import type { ChoosePortalRound, TrustOrReportRound } from '../src/game/types';
import { seededRng } from './helpers';

const round: ChoosePortalRound = {
  prompt: 'p',
  options: [
    { label: 'real', safe: true },
    { label: 'fake', safe: false, redFlag: 'typo' },
  ],
};
const unsafeItem: TrustOrReportRound = { prompt: 'p', item: { kind: 'link', text: 'x' }, safe: false, redFlag: 'rush' };
const safeItem: TrustOrReportRound = { prompt: 'p', item: { kind: 'message', text: 'y' }, safe: true, whySafe: 'known sender' };

describe('pickRoundIndex', () => {
  it('returns 0 when there is one round', () => {
    expect(pickRoundIndex(1, 0, () => 0.9)).toBe(0);
  });
  it('never repeats the previous index and stays in range', () => {
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const i = pickRoundIndex(3, 1, () => r);
      expect(i).not.toBe(1);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(3);
    }
  });
  it('can reach every other index', () => {
    const seen = new Set([0, 0.99].map((r) => pickRoundIndex(3, 1, () => r)));
    expect(seen).toEqual(new Set([0, 2]));
  });
  it('works with no previous', () => {
    expect(pickRoundIndex(3, null, () => 0.99)).toBe(2);
  });
});

describe('shuffled', () => {
  it('keeps the same members and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    expect(shuffled(input, seededRng(1)).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('judgePortal', () => {
  it('accepts the safe option', () => expect(judgePortal(round, 0)).toEqual({ correct: true }));
  it('returns the red flag for a fake', () =>
    expect(judgePortal(round, 1)).toEqual({ correct: false, redFlag: round.options[1].redFlag }));
});

describe('judgeTrust', () => {
  it('catches trusting an unsafe item', () =>
    expect(judgeTrust(unsafeItem, 'trust')).toEqual({ outcome: 'caught', redFlag: 'rush' }));
  it('passes reporting an unsafe item', () => expect(judgeTrust(unsafeItem, 'report')).toEqual({ outcome: 'pass' }));
  it('passes trusting a safe item', () => expect(judgeTrust(safeItem, 'trust')).toEqual({ outcome: 'pass' }));
  it('is gently over-suspicious when reporting a safe item', () =>
    expect(judgeTrust(safeItem, 'report')).toEqual({ outcome: 'over-suspicious', note: 'known sender' }));
});
