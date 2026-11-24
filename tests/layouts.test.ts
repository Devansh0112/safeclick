import { describe, expect, it } from 'vitest';
import { getLayout, LAYOUT_IDS } from '../src/game/layouts/index';
import type { LayoutData } from '../src/game/types';

// Movement values from LevelScene: gravity 1400, run 260, jump -620.
const MAX_GAP = 220;
// Peak jump height is 620² / (2 × 1400) ≈ 137 px; keep a safe margin.
const MAX_RISE = 120;

type Platform = LayoutData['platforms'][number];

function platformUnder(layout: LayoutData, point: { x: number; y: number }): Platform | undefined {
  return layout.platforms.find((p) => p.y > point.y && point.x >= p.x && point.x <= p.x + p.w);
}

describe('level layouts', () => {
  it('has the three Link Alley layouts', () => {
    expect(LAYOUT_IDS).toEqual(expect.arrayContaining(['alley-1', 'alley-2', 'alley-3']));
  });

  it('throws on an unknown layout id', () => {
    expect(() => getLayout('nope')).toThrow(/nope/);
  });

  describe.each(LAYOUT_IDS)('%s', (id) => {
    const layout = getLayout(id);

    it('loads with its own id', () => {
      expect(layout.id).toBe(id);
      expect(layout.platforms.length).toBeGreaterThan(0);
    });

    it('has gates sorted by x between start and exit', () => {
      const xs = layout.gates.map((g) => g.x);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
      for (const x of xs) {
        expect(x).toBeGreaterThan(layout.start.x);
        expect(x).toBeLessThan(layout.exit.x);
      }
    });

    it('has a platform under start, exit and every gate', () => {
      expect(platformUnder(layout, layout.start), 'start').toBeDefined();
      expect(platformUnder(layout, layout.exit), 'exit').toBeDefined();
      for (const g of layout.gates) {
        expect(platformUnder(layout, { x: g.x, y: layout.start.y }), `gate at ${g.x}`).toBeDefined();
      }
    });

    it(`has no gap wider than ${MAX_GAP} px between consecutive platforms`, () => {
      const sorted = [...layout.platforms].sort((a, b) => a.x - b.x);
      let reach = sorted[0].x + sorted[0].w;
      for (const p of sorted.slice(1)) {
        expect(p.x - reach, `gap before platform at x=${p.x}`).toBeLessThanOrEqual(MAX_GAP);
        reach = Math.max(reach, p.x + p.w);
      }
    });

    it(`never needs a climb higher than ${MAX_RISE} px`, () => {
      const sorted = [...layout.platforms].sort((a, b) => a.x - b.x);
      for (const p of sorted.slice(1)) {
        // The nearest platform to the left (by right edge) that a player could jump from.
        const from = sorted
          .filter((q) => q !== p && q.x < p.x)
          .reduce((best, q) => (q.x + q.w > best.x + best.w ? q : best));
        expect(from.y - p.y, `climb onto platform at x=${p.x}`).toBeLessThanOrEqual(MAX_RISE);
      }
    });

    it('fits inside its width and height', () => {
      for (const p of layout.platforms) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w).toBeLessThanOrEqual(layout.width);
        expect(p.y + p.h).toBeLessThanOrEqual(layout.height);
      }
      expect(layout.exit.x).toBeLessThan(layout.width);
    });
  });
});
