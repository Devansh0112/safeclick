/** Stars for a level: 3 for a clean run, 2 for one catch, 1 otherwise. */
export function starsFor(catches: number): 1 | 2 | 3 {
  if (catches <= 0) return 3;
  if (catches === 1) return 2;
  return 1;
}
