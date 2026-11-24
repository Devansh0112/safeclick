import { describe, expect, it } from 'vitest';
import { emptyProgress, type GameProgress } from '../src/game/logic/progress';
import { collectionView, isBossUnlocked, isLevelUnlocked, levelKey, revealableFiles } from '../src/game/logic/unlocks';
import type { DistrictData, ScamFileData } from '../src/game/types';

const lvl = (id: string) => ({ id }) as DistrictData['levels'][number];
const d = { id: 'link-alley', levels: [lvl('level-1'), lvl('level-2'), lvl('level-3')] } as DistrictData;
const file = (id: string, order: number) => ({ id, order }) as ScamFileData;

function withCleared(...keys: string[]): GameProgress {
  const p = emptyProgress();
  for (const k of keys) p.levels[k] = { cleared: true, bestStars: 1 };
  return p;
}

describe('unlocks', () => {
  it('builds level keys', () => expect(levelKey('link-alley', 'level-1')).toBe('link-alley/level-1'));
  it('unlocks levels in order', () => {
    expect(isLevelUnlocked(d, 0, emptyProgress())).toBe(true);
    expect(isLevelUnlocked(d, 1, emptyProgress())).toBe(false);
    expect(isLevelUnlocked(d, 1, withCleared('link-alley/level-1'))).toBe(true);
    expect(isLevelUnlocked(d, 2, withCleared('link-alley/level-1'))).toBe(false);
  });
  it('unlocks the boss only when every level is cleared', () => {
    expect(isBossUnlocked(d, withCleared('link-alley/level-1', 'link-alley/level-2'))).toBe(false);
    expect(isBossUnlocked(d, withCleared('link-alley/level-1', 'link-alley/level-2', 'link-alley/level-3'))).toBe(true);
  });
  it('reveals only rewards that have a scam file', () => {
    const a = file('a', 1);
    expect(revealableFiles(['a', 'draft-only'], [a])).toEqual([a]);
    expect(revealableFiles(['draft-only'], [])).toEqual([]);
  });
  it('orders the collection and flags collected files', () => {
    const a = file('a', 1);
    const b = file('b', 2);
    expect(collectionView([b, a], ['b'])).toEqual([
      { file: a, collected: false },
      { file: b, collected: true },
    ]);
  });
});
