// Age-level variants with fallback to the Everyone version.
//
// A content file can override some fields per level:
//   variants: { kids: { summary: "..." }, builders: { whatToDo: "..." } }
// `variantGroups` merges each level over the base, then groups levels that end up
// identical, so the page renders each distinct version once with
// data-levels="kids everyone ..." and CSS shows the one matching the toggle.
import { AGE_LEVELS, type AgeLevel } from '../site.config';

export interface VariantGroup<T> {
  levels: AgeLevel[];
  value: T;
  /** Space-separated, ready for the data-levels attribute. */
  attr: string;
}

export function variantGroups<T extends object>(
  base: T,
  variants: Partial<Record<AgeLevel, Partial<T> | undefined>> = {},
): VariantGroup<T>[] {
  const groups = new Map<string, VariantGroup<T>>();
  for (const level of AGE_LEVELS) {
    const override = variants[level] ?? {};
    const value = { ...base, ...stripEmpty(override) } as T;
    const key = JSON.stringify(value);
    const existing = groups.get(key);
    if (existing) existing.levels.push(level);
    else groups.set(key, { levels: [level], value, attr: '' });
  }
  return [...groups.values()].map((g) => ({ ...g, attr: g.levels.join(' ') }));
}

function stripEmpty<T extends object>(obj: Partial<T>): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;
}

/** Split plain text into paragraphs. Content is rendered as text, never HTML. */
export function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}
