// Content collections. Adding content = adding a file to src/content/<collection>/.
// Every content file shares the same review frontmatter (see `reviewFields`).
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const ageLevel = z.enum(['kids', 'everyone', 'builders']);
const reviewStatus = z.enum(['draft', 'in-review', 'reviewed']);

const source = z.object({
  title: z.string().min(1),
  url: z.url(),
});

/** Fields every reviewable content file must have. */
const reviewFields = {
  title: z.string().min(1),
  concept: reference('concepts'),
  relatedConcepts: z.array(reference('concepts')).default([]),
  ageLevels: z.array(ageLevel).min(1).default(['everyone']),
  summary: z.string().min(1),
  reviewStatus: reviewStatus.default('draft'),
  reviewer: z.string().optional(),
  reviewDate: z.coerce.date().optional(),
  sources: z.array(source).default([]),
};

/**
 * The review gate. A file marked "reviewed" MUST name its reviewer, review date
 * and at least one source. Fails the build (dev and production) if not.
 */
function reviewGate(data: { reviewStatus: string; reviewer?: string; reviewDate?: Date; sources: unknown[] }, ctx: z.RefinementCtx) {
  if (data.reviewStatus !== 'reviewed') return;
  if (!data.reviewer?.trim()) ctx.addIssue({ code: 'custom', message: 'Reviewed content needs a reviewer name.', path: ['reviewer'] });
  if (!data.reviewDate) ctx.addIssue({ code: 'custom', message: 'Reviewed content needs a review date.', path: ['reviewDate'] });
  if (data.sources.length < 1) ctx.addIssue({ code: 'custom', message: 'Reviewed content needs at least one source link.', path: ['sources'] });
}

/** Optional per-age-level overrides. Missing variants fall back to the Everyone version. */
const variantsOf = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object({
      kids: z.object(shape).partial().optional(),
      everyone: z.object(shape).partial().optional(),
      builders: z.object(shape).partial().optional(),
    })
    .default({});

// ---------------------------------------------------------------------------

/** Concept tags: the taxonomy that links everything together. */
const concepts = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/concepts' }),
  schema: z.object({
    title: z.string(),
    emoji: z.string().default('🔐'),
    short: z.string(),
    order: z.number().default(100),
  }),
});

const cards = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/cards' }),
  schema: z
    .object({
      ...reviewFields,
      type: z.literal('card').default('card'),
      redFlag: z.string().min(1),
      whatToDo: z.string().min(1),
      variants: variantsOf({ title: z.string(), summary: z.string(), body: z.string(), redFlag: z.string(), whatToDo: z.string() }),
    })
    .superRefine(reviewGate),
});

const videos = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/videos' }),
  schema: z
    .object({
      ...reviewFields,
      type: z.literal('video').default('video'),
      /** A YouTube URL. Leave empty while the video is a placeholder. */
      youtubeUrl: z.union([z.url(), z.literal('')]).default(''),
      durationSeconds: z.number().int().positive(),
      placeholder: z.boolean().default(false),
      transcript: z.string().optional(),
      variants: variantsOf({ title: z.string(), summary: z.string() }),
    })
    .superRefine(reviewGate),
});

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z
    .object({
      ...reviewFields,
      type: z.literal('article').default('article'),
      variants: variantsOf({ title: z.string(), summary: z.string() }),
    })
    .superRefine(reviewGate),
});

// --- Story games -----------------------------------------------------------
// Designed so a visual story builder can read and write the same JSON later:
// scenes are a flat map keyed by id, links are plain ids, and each scene may
// carry an optional `editor` position that the engine ignores.

const textVariants = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object({
      kids: z.object(shape).partial().optional(),
      builders: z.object(shape).partial().optional(),
    })
    .optional();

const choice = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
  to: z.string().min(1),
  /** Meter changes, e.g. { "trust": 10, "exposure": 25 } */
  effects: z.record(z.string(), z.number()).default({}),
  /** "safe" choices are what we hope players pick. "risky" ones show up in the Rewind. */
  safety: z.enum(['safe', 'risky', 'neutral']).default('neutral'),
  /** The warning sign the player missed (required for risky choices). */
  redFlag: z.string().optional(),
  /** What to do instead (required for risky choices), or why this was smart. */
  lesson: z.string().optional(),
  variants: textVariants({ label: z.string(), redFlag: z.string(), lesson: z.string() }),
});

const ending = z.object({
  kind: z.enum(['good', 'bad', 'mixed']),
  title: z.string().min(1),
  /** Short wrap-up shown on the Rewind screen. */
  rewindSummary: z.string().min(1),
});

const scene = z.object({
  speaker: z.string().optional(),
  /** How the scene is shown: a chat bubble, a text message, a phone call, or plain narration. */
  channel: z.enum(['narration', 'sms', 'call', 'chat', 'email', 'letter', 'web']).default('narration'),
  text: z.string().min(1),
  /** Red flags present in this scene, revealed on the Rewind screen. */
  redFlags: z.array(z.string()).default([]),
  choices: z.array(choice).default([]),
  ending: ending.optional(),
  variants: textVariants({ text: z.string(), speaker: z.string() }),
  /** Reserved for a future visual builder. Ignored by the engine. */
  editor: z.object({ x: z.number(), y: z.number() }).partial().optional(),
});

const meter = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string(),
  description: z.string().optional(),
  start: z.number().default(0),
  min: z.number().default(0),
  max: z.number().default(100),
  /** "high-is-bad" meters (like what the scammer knows) are drawn in warning colors. */
  polarity: z.enum(['high-is-good', 'high-is-bad', 'neutral']).default('neutral'),
});

export const storySchema = z
  .object({
    ...reviewFields,
    type: z.literal('story').default('story'),
    formatVersion: z.literal(1).default(1),
    estimatedMinutes: z.number().positive().default(5),
    showInOlderAdults: z.boolean().default(false),
    meters: z.array(meter).min(2),
    start: z.string(),
    scenes: z.record(z.string().regex(/^[a-z0-9-]+$/), scene),
    variants: variantsOf({ title: z.string(), summary: z.string() }),
  })
  .superRefine(reviewGate);

const stories = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/stories' }),
  schema: storySchema,
});

// --- Older Adults Corner ---------------------------------------------------

const readings = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/readings' }),
  schema: z
    .object({
      ...reviewFields,
      type: z.literal('reading').default('reading'),
      order: z.number().default(100),
      /** Plain-language "remember this" points shown in a box at the end. */
      keyPoints: z.array(z.string()).default([]),
    })
    .superRefine(reviewGate),
});

const quizzes = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/quizzes' }),
  schema: z
    .object({
      ...reviewFields,
      type: z.literal('quiz').default('quiz'),
      intro: z.string().optional(),
      questions: z
        .array(
          z.object({
            prompt: z.string().min(1),
            options: z
              .array(
                z.object({
                  text: z.string().min(1),
                  correct: z.boolean().default(false),
                  /** Kind, non-judgmental feedback shown after choosing this option. */
                  feedback: z.string().min(1),
                }),
              )
              .min(2),
          }),
        )
        .min(1),
    })
    .superRefine(reviewGate),
});

const handouts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/handouts' }),
  schema: z
    .object({
      ...reviewFields,
      type: z.literal('handout').default('handout'),
      kind: z.enum(['handout', 'guide']).default('handout'),
      order: z.number().default(100),
    })
    .superRefine(reviewGate),
});

// --- Neon City game --------------------------------------------------------
// Teaching text lives here so experts can review it; level geometry lives in code.

const slug = z.string().regex(/^[a-z0-9-]+$/);

const portalRound = z.object({
  prompt: z.string().min(1),
  options: z
    .array(z.object({ label: z.string().min(1), safe: z.boolean(), redFlag: z.string().optional() }))
    .min(2)
    .max(3),
});

const trustRound = z.object({
  prompt: z.string().min(1),
  item: z.object({ kind: z.enum(['link', 'message', 'popup', 'qr']), text: z.string().min(1) }),
  safe: z.boolean(),
  redFlag: z.string().optional(),
  /** Shown gently if the player reports a safe item by mistake. */
  whySafe: z.string().optional(),
});

const gameGate = z.discriminatedUnion('type', [
  z.object({ id: slug, type: z.literal('choose-portal'), rounds: z.array(portalRound).min(1) }),
  z.object({ id: slug, type: z.literal('trust-or-report'), rounds: z.array(trustRound).min(1) }),
]);

const gameLevel = z.object({
  id: slug,
  title: z.string().min(1),
  goal: z.string().min(1),
  habit: z.string().min(1),
  rule: z.string().min(1),
  /** Id of a layout file in src/game/layouts/. */
  layout: z.string().min(1),
  concept: reference('concepts').optional(),
  grownUpChallenge: z.object({
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    answer: z.number().int().min(0),
    explain: z.string().min(1),
  }),
  gates: z.array(gameGate).min(1),
});

const gameBoss = z.object({
  name: z.string().min(1),
  intro: z.string().min(1),
  waves: z.array(
    z.object({
      messages: z.array(z.object({ text: z.string().min(1), fake: z.boolean(), redFlag: z.string().optional() })).min(2),
    }),
  ),
});

const gameDistricts = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/gameDistricts' }),
  schema: z
    .object({
      ...reviewFields,
      formatVersion: z.literal(1).default(1),
      order: z.number(),
      habit: z.string().min(1),
      levels: z.array(gameLevel).min(1),
      boss: gameBoss,
      scamFileRewards: z.array(slug).default([]),
    })
    .superRefine(reviewGate),
});

const scamFiles = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/scamFiles' }),
  schema: z
    .object({
      ...reviewFields,
      example: z.string().min(1),
      howToSpot: z.string().min(1),
      whatToDo: z.string().min(1),
      /** Id of the district this file previews (it may not exist yet). */
      district: z.string().min(1),
      order: z.number().default(100),
    })
    .superRefine(reviewGate),
});

export const collections = { concepts, cards, videos, articles, stories, readings, quizzes, handouts, gameDistricts, scamFiles };
