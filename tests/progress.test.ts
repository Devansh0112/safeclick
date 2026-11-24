import { describe, expect, it } from 'vitest';
import { emptyProgress, loadProgress, recordBoss, recordLevel, resetProgress, saveProgress } from '../src/game/logic/progress';
import { kv, throwingKv } from './helpers';

const stories = { 'phone-scam': { done: true } };
const withStories = () => kv({ 'sc-progress': JSON.stringify({ stories }) });

describe('loadProgress', () => {
  it('returns empty for missing, corrupt, wrong-version or blocked storage', () => {
    expect(loadProgress(kv({}))).toEqual(emptyProgress());
    expect(loadProgress(kv({ 'sc-progress': '{not json' }))).toEqual(emptyProgress());
    expect(loadProgress(kv({ 'sc-progress': '{"games":{"neonCity":{"version":99}}}' }))).toEqual(emptyProgress());
    expect(loadProgress(throwingKv())).toEqual(emptyProgress());
  });
  it('rejects wrongly typed fields', () => {
    const bad = { ...emptyProgress(), scamFiles: [1] };
    expect(loadProgress(kv({ 'sc-progress': JSON.stringify({ games: { neonCity: bad } }) }))).toEqual(emptyProgress());
  });
  it('round-trips saved progress', () => {
    const k = kv();
    const p = recordBoss(recordLevel(emptyProgress(), 'link-alley/level-1', 2), 'link-alley', ['a']);
    saveProgress(k, p);
    expect(loadProgress(k)).toEqual(p);
  });
});

describe('saveProgress / resetProgress', () => {
  it('keeps story progress when saving', () => {
    const k = withStories();
    saveProgress(k, recordLevel(emptyProgress(), 'link-alley/level-1', 2));
    expect(JSON.parse(k.get('sc-progress')!).stories).toEqual(stories);
  });
  it('does not throw when storage is blocked', () => {
    expect(() => saveProgress(throwingKv(), emptyProgress())).not.toThrow();
    expect(() => resetProgress(throwingKv())).not.toThrow();
  });
  it('reset removes only the game progress', () => {
    const k = withStories();
    saveProgress(k, recordLevel(emptyProgress(), 'link-alley/level-1', 3));
    resetProgress(k);
    const root = JSON.parse(k.get('sc-progress')!);
    expect(root.stories).toEqual(stories);
    expect(root.games?.neonCity).toBeUndefined();
    expect(loadProgress(k)).toEqual(emptyProgress());
  });
});

describe('recording', () => {
  it('keeps the best star count', () => {
    const key = 'link-alley/level-1';
    const p = recordLevel(recordLevel(emptyProgress(), key, 3), key, 1);
    expect(p.levels[key]).toEqual({ cleared: true, bestStars: 3 });
  });
  it('dedupes scam files and marks the boss defeated', () => {
    const p = recordBoss(emptyProgress(), 'link-alley', ['a', 'a', 'b']);
    expect(p.scamFiles).toEqual(['a', 'b']);
    expect(p.bosses['link-alley']).toEqual({ defeated: true });
  });
  it('does not mutate its input', () => {
    const p = emptyProgress();
    recordLevel(p, 'x/y', 2);
    expect(p).toEqual(emptyProgress());
  });
});
