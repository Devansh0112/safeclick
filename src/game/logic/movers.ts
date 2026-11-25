export interface MoverPath {
  dx: number;
  dy: number;
  periodMs: number;
}

/** Position of a moving platform at time tMs: a cosine ease from base out to base + (dx, dy) and back. */
export function moverTarget(base: { x: number; y: number }, move: MoverPath, tMs: number): { x: number; y: number } {
  const phase = (1 - Math.cos((2 * Math.PI * tMs) / move.periodMs)) / 2;
  return { x: base.x + move.dx * phase, y: base.y + move.dy * phase };
}

/**
 * Velocity (px/s) that carries a body from its current position to where the path
 * says it should be after one fixed physics step of stepMs. Computed per physics step
 * (not per rendered frame), so it is correct at any frame rate.
 */
export function moverVelocity(
  base: { x: number; y: number },
  move: MoverPath,
  nextTimeMs: number,
  stepMs: number,
  pos: { x: number; y: number },
): { x: number; y: number } {
  const t = moverTarget(base, move, nextTimeMs);
  const s = stepMs / 1000;
  return { x: (t.x - pos.x) / s, y: (t.y - pos.y) / s };
}
