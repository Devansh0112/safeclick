import type { ChoosePortalRound, TrustOrReportRound } from '../types';

/** Pick a round index, avoiding an immediate repeat of `previous` when possible. */
export function pickRoundIndex(roundCount: number, previous: number | null, rng: () => number): number {
  if (roundCount <= 1) return 0;
  const pool = roundCount - (previous !== null && previous >= 0 && previous < roundCount ? 1 : 0);
  let i = Math.min(pool - 1, Math.floor(rng() * pool));
  if (previous !== null && previous >= 0 && previous < roundCount && i >= previous) i += 1;
  return i;
}

/** Fisher-Yates shuffle into a new array. */
export function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function judgePortal(
  round: ChoosePortalRound,
  optionIndex: number,
): { correct: true } | { correct: false; redFlag: string } {
  const option = round.options[optionIndex];
  if (option?.safe) return { correct: true };
  return { correct: false, redFlag: option?.redFlag ?? '' };
}

export function judgeTrust(
  round: TrustOrReportRound,
  choice: 'trust' | 'report',
): { outcome: 'pass' } | { outcome: 'caught'; redFlag: string } | { outcome: 'over-suspicious'; note: string } {
  if (round.safe) {
    return choice === 'trust' ? { outcome: 'pass' } : { outcome: 'over-suspicious', note: round.whySafe ?? '' };
  }
  return choice === 'report' ? { outcome: 'pass' } : { outcome: 'caught', redFlag: round.redFlag ?? '' };
}
