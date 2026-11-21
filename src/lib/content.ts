// The review gate, applied everywhere content is listed or rendered.
//
//   astro dev              -> shows draft, in-review and reviewed content (with a banner)
//   npm run build          -> ONLY reviewed content is built
//   npm run build:preview  -> includes drafts, for private staging previews only
import { getCollection, type CollectionEntry } from 'astro:content';

export type ReviewedCollection = 'cards' | 'videos' | 'articles' | 'stories' | 'readings' | 'quizzes' | 'handouts';
export type AnyEntry = CollectionEntry<ReviewedCollection>;

export const INCLUDE_DRAFTS: boolean =
  import.meta.env.DEV || process.env.SAFECLICK_INCLUDE_DRAFTS === '1';

export function isVisible(entry: { data: { reviewStatus: string } }): boolean {
  return INCLUDE_DRAFTS || entry.data.reviewStatus === 'reviewed';
}

export async function getPublished<C extends ReviewedCollection>(name: C): Promise<CollectionEntry<C>[]> {
  const entries = await getCollection(name, (e) => isVisible(e as AnyEntry));
  return entries.sort((a, b) => a.data.title.localeCompare(b.data.title));
}

export async function getConcepts() {
  const concepts = await getCollection('concepts');
  return concepts.sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title));
}

/** URL for any content entry. Keep in one place so links never drift. */
export function urlFor(collection: string, id: string): string {
  switch (collection) {
    case 'cards': return `/cards/${id}/`;
    case 'videos': return `/videos/${id}/`;
    case 'articles': return `/articles/${id}/`;
    case 'stories': return `/stories/${id}/`;
    case 'readings': return `/older-adults/readings/${id}/`;
    case 'quizzes': return `/older-adults/quizzes/${id}/`;
    case 'handouts': return `/older-adults/handouts/${id}/`;
    case 'concepts': return `/concepts/${id}/`;
    default: return '/';
  }
}

export const TYPE_LABELS: Record<ReviewedCollection, { label: string; emoji: string }> = {
  cards: { label: 'Card', emoji: '🃏' },
  videos: { label: 'Video', emoji: '🎬' },
  articles: { label: 'Article', emoji: '📖' },
  stories: { label: 'Story game', emoji: '🎮' },
  readings: { label: 'Reading', emoji: '☕' },
  quizzes: { label: 'Quiz', emoji: '✅' },
  handouts: { label: 'Handout', emoji: '🖨️' },
};

/** Everything (visible) that is tagged with a concept, as primary or related. */
export async function getByConcept(conceptId: string) {
  const names: ReviewedCollection[] = ['cards', 'videos', 'articles', 'stories', 'readings', 'quizzes', 'handouts'];
  const out: Record<ReviewedCollection, AnyEntry[]> = {
    cards: [], videos: [], articles: [], stories: [], readings: [], quizzes: [], handouts: [],
  };
  for (const name of names) {
    const entries = (await getPublished(name)) as AnyEntry[];
    out[name] = entries.filter(
      (e) => e.data.concept.id === conceptId || e.data.relatedConcepts.some((c) => c.id === conceptId),
    );
  }
  return out;
}

export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}:${String(s).padStart(2, '0')}` : `0:${String(s).padStart(2, '0')}`;
}
