import type { BossData, BossMessage } from '../types';

export const BOSS_TIMING = { maxHits: 3, travelMs: 4000, spawnEveryMs: [4000, 3200, 2500], reducedMotionFactor: 1.5 };

export type BossAction = 'shield' | 'pass';
export type BossEvent = 'damage' | 'bonus' | 'hit' | 'gentle-note' | 'ignored';

export interface BossState {
  health: number;
  maxHealth: number;
  hits: number;
  wave: 0 | 1 | 2;
  status: 'fighting' | 'won' | 'caught';
  caughtBy: BossMessage | null;
  resolved: ReadonlySet<string>;
}

export function createBoss(boss: BossData): BossState {
  const fakes = boss.waves.reduce((n, w) => n + w.messages.filter((m) => m.fake).length, 0);
  const maxHealth = Math.max(3, fakes - 2);
  return { health: maxHealth, maxHealth, hits: 0, wave: 0, status: 'fighting', caughtBy: null, resolved: new Set() };
}

export function messageId(wave: number, index: number, loop: number): string {
  return `w${wave}-${index}-${loop}`;
}

export function resolveMessage(
  s: BossState,
  id: string,
  msg: BossMessage,
  action: BossAction,
): { state: BossState; event: BossEvent } {
  if (s.status !== 'fighting' || s.resolved.has(id)) return { state: s, event: 'ignored' };
  const resolved = new Set(s.resolved).add(id);

  if (action === 'shield') {
    if (!msg.fake) return { state: { ...s, resolved }, event: 'gentle-note' };
    const health = s.health - 1;
    return { state: { ...s, resolved, health, status: health <= 0 ? 'won' : 'fighting' }, event: 'damage' };
  }
  if (!msg.fake) return { state: { ...s, resolved, hits: Math.max(0, s.hits - 1) }, event: 'bonus' };
  const hits = s.hits + 1;
  const caught = hits >= BOSS_TIMING.maxHits;
  return {
    state: { ...s, resolved, hits, status: caught ? 'caught' : 'fighting', caughtBy: caught ? msg : null },
    event: 'hit',
  };
}

export function advanceWave(s: BossState): BossState {
  return { ...s, wave: Math.min(2, s.wave + 1) as 0 | 1 | 2 };
}
