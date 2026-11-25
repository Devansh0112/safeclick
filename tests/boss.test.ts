import { describe, expect, it } from 'vitest';
import { advanceWave, BOSS_TIMING, createBoss, messageId, MIN_CURRENT_MS, resolveMessage, worstCaseCurrentMs } from '../src/game/logic/boss';
import { ACTION_GAP_MS, actionAccepted } from '../src/game/ui/boss-panel';
import type { BossData, BossMessage } from '../src/game/types';

const fake = (n: number): BossMessage => ({ text: `fake ${n}`, fake: true, redFlag: 'flag' });
const real: BossMessage = { text: 'real', fake: false };
const wave = () => ({ messages: [fake(1), fake(2), real] });
const boss: BossData = { name: 'B', intro: 'i', waves: [wave(), wave(), wave()] };

describe('createBoss', () => {
  it('sets maxHealth = max(3, fakes - 2)', () => {
    const s = createBoss(boss);
    expect(s.maxHealth).toBe(4);
    expect(s.health).toBe(4);
    expect(s.status).toBe('fighting');
    const small: BossData = { ...boss, waves: [{ messages: [fake(1), real] }] };
    expect(createBoss(small).maxHealth).toBe(3);
  });
  it('exposes timing and ids', () => {
    expect(BOSS_TIMING.maxHits).toBe(3);
    expect(messageId(0, 0, 0)).toBe('w0-0-0');
  });
});

describe('resolveMessage', () => {
  it('damages the boss when a fake is shielded', () => {
    const r = resolveMessage(createBoss(boss), 'w0-0-0', fake(1), 'shield');
    expect(r.event).toBe('damage');
    expect(r.state.health).toBe(3);
  });
  it('adds a hit when a fake is passed', () => {
    const r = resolveMessage(createBoss(boss), 'w0-0-0', fake(1), 'pass');
    expect(r.event).toBe('hit');
    expect(r.state.hits).toBe(1);
  });
  it('gives a bonus (hits -1, min 0) when a real message is passed', () => {
    const s0 = createBoss(boss);
    expect(resolveMessage(s0, 'w0-2-0', real, 'pass').state.hits).toBe(0);
    const hit = resolveMessage(s0, 'w0-0-0', fake(1), 'pass').state;
    const r = resolveMessage(hit, 'w0-2-0', real, 'pass');
    expect(r.event).toBe('bonus');
    expect(r.state.hits).toBe(0);
  });
  it('gives a gentle note when a real message is shielded', () => {
    const r = resolveMessage(createBoss(boss), 'w0-2-0', real, 'shield');
    expect(r.event).toBe('gentle-note');
    expect(r.state.health).toBe(4);
    expect(r.state.hits).toBe(0);
  });
  it('is caught after three fakes get through', () => {
    let s = createBoss(boss);
    const third = fake(3);
    s = resolveMessage(s, 'a', fake(1), 'pass').state;
    s = resolveMessage(s, 'b', fake(2), 'pass').state;
    expect(s.status).toBe('fighting');
    s = resolveMessage(s, 'c', third, 'pass').state;
    expect(s.status).toBe('caught');
    expect(s.caughtBy).toBe(third);
  });
  it('wins after maxHealth fakes are shielded', () => {
    let s = createBoss(boss);
    for (let i = 0; i < 4; i++) s = resolveMessage(s, `id${i}`, fake(i), 'shield').state;
    expect(s.status).toBe('won');
    expect(s.health).toBe(0);
  });
  it('ignores an already resolved id', () => {
    const once = resolveMessage(createBoss(boss), 'w0-0-0', fake(1), 'shield').state;
    const again = resolveMessage(once, 'w0-0-0', fake(1), 'shield');
    expect(again.event).toBe('ignored');
    expect(again.state).toBe(once);
  });
  it('ignores everything once the fight is over', () => {
    let s = createBoss(boss);
    for (let i = 0; i < 4; i++) s = resolveMessage(s, `id${i}`, fake(i), 'shield').state;
    const r = resolveMessage(s, 'w1-0-0', fake(1), 'shield');
    expect(r.event).toBe('ignored');
    expect(r.state).toBe(s);
  });
  it('does not mutate the previous state', () => {
    const s = createBoss(boss);
    resolveMessage(s, 'x', fake(1), 'shield');
    expect(s.health).toBe(4);
    expect(s.resolved.size).toBe(0);
  });
});

describe('advanceWave', () => {
  it('clamps at wave 2', () => {
    const s = createBoss(boss);
    expect(advanceWave(s).wave).toBe(1);
    expect(advanceWave(advanceWave(advanceWave(s))).wave).toBe(2);
  });
});

describe('boss readability (Global Constraint: each card current >= 3000 ms)', () => {
  it('keeps every wave\'s worst-case current time at or above 3000 ms at factor 1 and with reduced motion', () => {
    expect(MIN_CURRENT_MS).toBe(3000);
    BOSS_TIMING.spawnEveryMs.forEach((_, w) => {
      expect(worstCaseCurrentMs(w)).toBeGreaterThanOrEqual(MIN_CURRENT_MS);
      expect(worstCaseCurrentMs(w, BOSS_TIMING.reducedMotionFactor)).toBeGreaterThanOrEqual(MIN_CURRENT_MS);
    });
  });
  it('derives the bound from the spawn gap minus one clock step, capped by the trip', () => {
    const [w1, w2, w3] = BOSS_TIMING.spawnEveryMs;
    expect(worstCaseCurrentMs(2)).toBe(Math.min(BOSS_TIMING.travelMs, w3 - BOSS_TIMING.maxStepMs));
    expect(worstCaseCurrentMs(0)).toBe(Math.min(BOSS_TIMING.travelMs, w1 - BOSS_TIMING.maxStepMs));
    expect(w2).toBeGreaterThan(w3);
  });
  it('gets harder by sending cards more often, not by moving them faster', () => {
    const gaps = BOSS_TIMING.spawnEveryMs;
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeLessThan(gaps[i - 1]);
    // One travel time for every wave: card speed never changes.
    expect(typeof BOSS_TIMING.travelMs).toBe('number');
    expect(BOSS_TIMING.travelMs).toBeGreaterThanOrEqual(MIN_CURRENT_MS);
  });
});

describe('boss action gap', () => {
  const run = (times: number[]) => {
    let last = -Infinity;
    return times.filter((t) => {
      if (!actionAccepted(t, last)) return false;
      last = t;
      return true;
    });
  };
  it('accepts presses at 0 and 400 out of 0, 200, 400, 600 ms', () => {
    expect(ACTION_GAP_MS).toBe(300);
    expect(run([0, 200, 400, 600])).toEqual([0, 400]);
  });
  it('ignored presses never re-arm the gap, so mashing still gets through', () => {
    // Faster than 3.3 presses a second: before the fix every press after the first was lost.
    expect(run([0, 250, 500, 750, 1000])).toEqual([0, 500, 1000]);
  });
});
