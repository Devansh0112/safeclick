import { describe, expect, it } from 'vitest';
import { moverTarget, moverVelocity } from '../src/game/logic/movers';

const base = { x: 100, y: 500 };
const move = { dx: 200, dy: -100, periodMs: 4000 };

describe('movers', () => {
  it('starts at base, reaches the far end at half a period', () => {
    expect(moverTarget(base, move, 0)).toEqual(base);
    const far = moverTarget(base, move, 2000);
    expect(far.x).toBeCloseTo(300);
    expect(far.y).toBeCloseTo(400);
  });

  it('tracks the path with fixed 60 Hz steps regardless of frame rate', () => {
    const step = 1000 / 60;
    for (const stepsPerFrame of [0.5, 1, 3, 6]) {
      let pos = { ...base };
      let t = 0;
      let carry = 0;
      let maxDev = 0;
      for (let frame = 0; frame < 600; frame++) {
        carry += stepsPerFrame;
        while (carry >= 1) {
          carry -= 1;
          const v = moverVelocity(base, move, t + step, step, pos);
          pos = { x: pos.x + (v.x * step) / 1000, y: pos.y + (v.y * step) / 1000 };
          t += step;
          const want = moverTarget(base, move, t);
          maxDev = Math.max(maxDev, Math.abs(pos.x - want.x), Math.abs(pos.y - want.y));
          expect(pos.x).toBeGreaterThanOrEqual(base.x - 0.001);
          expect(pos.x).toBeLessThanOrEqual(base.x + move.dx + 0.001);
        }
      }
      expect(maxDev).toBeLessThan(0.01);
    }
  });
});
