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

  // Models the engine: per rendered frame, `body` integrates every fixed step with that step's
  // velocity, but the GameObject position is only copied from the body once per frame.
  function simulate(useStale: boolean, stepsPerFrame: number): number {
    const step = 1000 / 60;
    let body = { ...base };
    let gameObject = { ...base };
    let t = 0;
    let carry = 0;
    let maxDev = 0;
    for (let frame = 0; frame < 600; frame++) {
      carry += stepsPerFrame;
      while (carry >= 1) {
        carry -= 1;
        const v = moverVelocity(base, move, t + 2 * step, step, useStale ? gameObject : body);
        // (the world step has just run; this velocity drives the NEXT step)
        t += step;
        body = { x: body.x + (v.x * step) / 1000, y: body.y + (v.y * step) / 1000 };
        const want = moverTarget(base, move, t + step);
        maxDev = Math.max(maxDev, Math.abs(body.x - want.x), Math.abs(body.y - want.y));
      }
      gameObject = { ...body };
    }
    return maxDev;
  }

  it('tracks the path at any frame rate when driven from body position', () => {
    for (const n of [0.5, 1, 3, 6]) expect(simulate(false, n)).toBeLessThan(0.01);
  });

  it('would diverge if driven from the stale GameObject position (regression guard)', () => {
    expect(simulate(true, 3)).toBeGreaterThan(50);
  });
});
