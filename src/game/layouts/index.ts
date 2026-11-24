// Typed access to the level geometry files. Static imports so Vite bundles them.
import type { LayoutData } from '../types';
import alley1 from './alley-1.json';
import alley2 from './alley-2.json';
import alley3 from './alley-3.json';

const LAYOUTS: Record<string, LayoutData> = Object.fromEntries(
  ([alley1, alley2, alley3] as LayoutData[]).map((l) => [l.id, l]),
);

export const LAYOUT_IDS: string[] = Object.keys(LAYOUTS);

export function getLayout(id: string): LayoutData {
  const layout = LAYOUTS[id];
  if (!layout) throw new Error(`Unknown layout "${id}"`);
  return layout;
}
