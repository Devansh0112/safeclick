import { describe, expect, it } from 'vitest';
import { reportFrom } from '../src/game/ui/touch-controls';

const held = (on: string[]) => {
  const ids = ['left', 'right', 'jump', 'jumpLeft', 'jumpRight'] as const;
  return Object.fromEntries(ids.map((id) => [id, { size: on.includes(id) ? 1 : 0 }])) as Record<(typeof ids)[number], { size: number }>;
};

describe('touch control report', () => {
  it('plain buttons are unchanged', () => {
    expect(reportFrom(held(['left']))).toEqual({ left: true, right: false, jump: false });
    expect(reportFrom(held(['left', 'jump']))).toEqual({ left: true, right: false, jump: true });
    expect(reportFrom(held([]))).toEqual({ left: false, right: false, jump: false });
  });
  it('jump-left reports left and jump', () => {
    expect(reportFrom(held(['jumpLeft']))).toEqual({ left: true, right: false, jump: true });
  });
  it('jump-right reports right and jump', () => {
    expect(reportFrom(held(['jumpRight']))).toEqual({ left: false, right: true, jump: true });
  });
});
