import { STORAGE_KEYS } from '../../site.config';

export interface GameProgress {
  version: 1;
  levels: Record<string, { cleared: boolean; bestStars: 1 | 2 | 3 }>;
  bosses: Record<string, { defeated: boolean }>;
  scamFiles: string[];
  /** reducedMotion null means "follow the system setting". */
  settings: { muted: boolean; reducedMotion: boolean | null };
}

export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const KEY = STORAGE_KEYS.progress;

export function emptyProgress(): GameProgress {
  return { version: 1, levels: {}, bosses: {}, scamFiles: [], settings: { muted: false, reducedMotion: null } };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function valid(v: unknown): v is GameProgress {
  if (!isObj(v) || v.version !== 1) return false;
  if (!isObj(v.levels) || !isObj(v.bosses) || !isObj(v.settings)) return false;
  for (const l of Object.values(v.levels)) {
    if (!isObj(l) || typeof l.cleared !== 'boolean' || ![1, 2, 3].includes(l.bestStars as number)) return false;
  }
  for (const b of Object.values(v.bosses)) {
    if (!isObj(b) || typeof b.defeated !== 'boolean') return false;
  }
  if (!Array.isArray(v.scamFiles) || !v.scamFiles.every((f) => typeof f === 'string')) return false;
  if (typeof v.settings.muted !== 'boolean') return false;
  const rm = v.settings.reducedMotion;
  return rm === null || typeof rm === 'boolean';
}

/** Read the whole shared sc-progress object, or {} when missing/corrupt/blocked. */
function readRoot(kv: KV): Record<string, unknown> {
  try {
    const raw = kv.get(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return isObj(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeRoot(kv: KV, root: Record<string, unknown>): void {
  try {
    kv.set(KEY, JSON.stringify(root));
  } catch {
    /* storage unavailable: progress just won't persist */
  }
}

export function loadProgress(kv: KV): GameProgress {
  const games = readRoot(kv).games;
  const neon = isObj(games) ? games.neonCity : undefined;
  return valid(neon) ? neon : emptyProgress();
}

/** Saves under games.neonCity, keeping every other top-level key (e.g. stories). */
export function saveProgress(kv: KV, p: GameProgress): void {
  const root = readRoot(kv);
  const games = isObj(root.games) ? root.games : {};
  writeRoot(kv, { ...root, games: { ...games, neonCity: p } });
}

export function recordLevel(p: GameProgress, key: string, stars: 1 | 2 | 3): GameProgress {
  const best = Math.max(p.levels[key]?.bestStars ?? 0, stars) as 1 | 2 | 3;
  return { ...p, levels: { ...p.levels, [key]: { cleared: true, bestStars: best } } };
}

export function recordBoss(p: GameProgress, districtId: string, fileIds: string[]): GameProgress {
  return {
    ...p,
    bosses: { ...p.bosses, [districtId]: { defeated: true } },
    scamFiles: [...new Set([...p.scamFiles, ...fileIds])],
  };
}

/** Removes only games.neonCity; other keys (stories etc.) are kept. */
export function resetProgress(kv: KV): void {
  const root = readRoot(kv);
  const games = isObj(root.games) ? { ...root.games } : {};
  delete games.neonCity;
  const next: Record<string, unknown> = { ...root };
  if (Object.keys(games).length > 0) next.games = games;
  else delete next.games;
  writeRoot(kv, next);
}
