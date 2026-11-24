import type { DistrictData, ScamFileData } from '../types';
import type { GameProgress } from './progress';

export function levelKey(districtId: string, levelId: string): string {
  return `${districtId}/${levelId}`;
}

const cleared = (d: DistrictData, i: number, p: GameProgress) =>
  p.levels[levelKey(d.id, d.levels[i].id)]?.cleared === true;

export function isLevelUnlocked(d: DistrictData, levelIndex: number, p: GameProgress): boolean {
  if (levelIndex < 0 || levelIndex >= d.levels.length) return false;
  return levelIndex === 0 || cleared(d, levelIndex - 1, p);
}

export function isBossUnlocked(d: DistrictData, p: GameProgress): boolean {
  return d.levels.every((_, i) => cleared(d, i, p));
}

/** Reward ids that have a real scam file (drafts without a file are skipped). */
export function revealableFiles(rewardIds: string[], files: ScamFileData[]): ScamFileData[] {
  return rewardIds.flatMap((id) => files.filter((f) => f.id === id));
}

export function collectionView(
  files: ScamFileData[],
  collected: string[],
): { file: ScamFileData; collected: boolean }[] {
  return [...files]
    .sort((a, b) => a.order - b.order)
    .map((file) => ({ file, collected: collected.includes(file.id) }));
}
