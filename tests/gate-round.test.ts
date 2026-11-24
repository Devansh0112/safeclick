import { describe, expect, it } from 'vitest';
import { FALLBACK_NOTE, FALLBACK_RED_FLAG, GateRound } from '../src/game/logic/gate-round';
import type { GateData } from '../src/game/types';
import { seededRng } from './helpers';

const portalGate: GateData = {
  id: 'gate-1',
  type: 'choose-portal',
  rounds: [
    {
      prompt: 'Find the Library',
      options: [
        { label: 'library.org', safe: true },
        { label: 'libary.org', safe: false, redFlag: 'missing an r' },
        { label: 'library.win', safe: false },
      ],
    },
    { prompt: 'Find the shop', options: [{ label: 'shop.example', safe: true }, { label: 'sh0p.example', safe: false, redFlag: 'zero' }] },
  ],
};

const trustGate: GateData = {
  id: 'gate-2',
  type: 'trust-or-report',
  rounds: [
    { prompt: 'Safe one', item: { kind: 'message', text: 'Gran: dinner at 6' }, safe: true, whySafe: 'You know Gran.' },
    { prompt: 'Fake one', item: { kind: 'link', text: 'http://x.win' }, safe: false, redFlag: 'ends in .win' },
  ],
};

const positionOf = (r: GateRound, label: string) => r.view.choices.findIndex((c) => c.label === label);

describe('GateRound (choose-portal)', () => {
  it('shows every option of the picked round, in some order', () => {
    const r = new GateRound(portalGate, 1, seededRng(3));
    expect(r.index).toBe(0);
    expect(r.view.prompt).toBe('Find the Library');
    expect(r.view.choices.map((c) => c.label).sort()).toEqual(['libary.org', 'library.org', 'library.win']);
  });

  it('maps screen positions back to options after shuffling', () => {
    for (let seed = 1; seed < 20; seed++) {
      const safe = new GateRound(portalGate, 1, seededRng(seed));
      expect(safe.choose(positionOf(safe, 'library.org'))).toEqual({ kind: 'pass' });
      const wrong = new GateRound(portalGate, 1, seededRng(seed));
      expect(wrong.choose(positionOf(wrong, 'libary.org'))).toEqual({ kind: 'caught', redFlag: 'missing an r' });
    }
  });

  it('shuffles the order across rounds', () => {
    const orders = new Set(Array.from({ length: 30 }, (_, s) => new GateRound(portalGate, 1, seededRng(s + 1)).view.choices.map((c) => c.label).join()));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('counts a repeated choice once', () => {
    const r = new GateRound(portalGate, 1, seededRng(5));
    const wrong = positionOf(r, 'libary.org');
    const results = Array.from({ length: 5 }, () => r.choose(wrong));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(r.isLocked).toBe(true);
  });

  it('ignores out-of-range positions without locking', () => {
    const r = new GateRound(portalGate, 1, seededRng(5));
    expect(r.choose(7)).toBeNull();
    expect(r.choose(-1)).toBeNull();
    expect(r.isLocked).toBe(false);
  });

  it('uses a fallback line when a red flag is missing', () => {
    const r = new GateRound(portalGate, 1, seededRng(2));
    expect(r.choose(positionOf(r, 'library.win'))).toEqual({ kind: 'caught', redFlag: FALLBACK_RED_FLAG });
  });

  it('picks a different round on retry', () => {
    const first = new GateRound(portalGate, null, seededRng(9));
    const retry = new GateRound(portalGate, first.index, seededRng(10));
    expect(retry.index).not.toBe(first.index);
  });
});

describe('GateRound (trust-or-report)', () => {
  it('offers TRUST then REPORT with the item', () => {
    const r = new GateRound(trustGate, 1, seededRng(1));
    expect(r.view.choices.map((c) => c.label)).toEqual(['TRUST', 'REPORT']);
    expect(r.view.item).toEqual({ kind: 'message', text: 'Gran: dinner at 6' });
  });

  it('reporting a safe item is a gentle note and the round can be answered again', () => {
    const r = new GateRound(trustGate, 1, seededRng(1));
    expect(r.choose(1)).toEqual({ kind: 'over-suspicious', note: 'You know Gran.' });
    expect(r.choose(0)).toBeNull();
    r.unlock();
    expect(r.choose(0)).toEqual({ kind: 'pass' });
  });

  it('trusting a fake item is caught; reporting it passes', () => {
    expect(new GateRound(trustGate, 0, seededRng(1)).choose(0)).toEqual({ kind: 'caught', redFlag: 'ends in .win' });
    expect(new GateRound(trustGate, 0, seededRng(1)).choose(1)).toEqual({ kind: 'pass' });
  });

  it('uses a fallback note when whySafe is missing', () => {
    const gate: GateData = { ...trustGate, rounds: [{ ...trustGate.rounds[0], whySafe: '' }] };
    expect(new GateRound(gate, null, seededRng(1)).choose(1)).toEqual({ kind: 'over-suspicious', note: FALLBACK_NOTE });
  });
});
