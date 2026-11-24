import { describe, expect, it } from 'vitest';
import { starsFor } from '../src/game/logic/scoring';

describe('starsFor', () => {
  it('awards 3, 2, then 1 star as catches grow', () => {
    expect(starsFor(0)).toBe(3);
    expect(starsFor(1)).toBe(2);
    expect(starsFor(2)).toBe(1);
    expect(starsFor(9)).toBe(1);
  });
});
