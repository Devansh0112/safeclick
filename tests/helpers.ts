import type { KV } from '../src/game/logic/progress';

/** Small deterministic rng (mulberry32). */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function kv(initial: Record<string, string> = {}): KV & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
}

export function throwingKv(): KV {
  return {
    get() { throw new Error('blocked'); },
    set() { throw new Error('blocked'); },
  };
}
