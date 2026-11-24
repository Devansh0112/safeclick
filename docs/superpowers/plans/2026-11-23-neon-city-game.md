# Neon City Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build SafeClick's first game, Neon City, with its first district Link Alley: 3 platform levels with security gates, the PHISH.BOT boss, the stash reveal and Scam Files. Ship it hidden in production behind the existing review gate.

**Architecture:**
- Teaching text lives in two new reviewed content collections, `gameDistricts` and `scamFiles`. It's checked by the existing validator and embedded into the game page as JSON.
- Game rules (stars, round picking, unlocks, saved progress, boss damage) are plain TypeScript functions with Vitest tests.
- Phaser scenes draw the action.
- An HTML overlay layer, written with `textContent` only, handles every reading screen.

**Tech Stack:** Astro 7, TypeScript (strict), Phaser 4 (`phaser@^4.2.1`, the current npm `latest`), Vitest 5, Node ≥ 22.12 (Node is at `~/.local/node/bin` on the dev machine, so put it on `PATH`), Web Audio API for sound.

**Spec:** `docs/superpowers/specs/2026-11-23-neon-city-game-design.md` (read it alongside this plan; section numbers below refer to it).

## Global Constraints

- **Privacy:** no cookies, analytics, trackers, third-party requests or personal data. Phaser is bundled from npm, never loaded from a CDN.
- **Storage:** progress lives only under the existing `sc-progress` localStorage key (`STORAGE_KEYS.progress`), in `games.neonCity`. Every access goes through try/catch.
- **Content is data:** render content strings with Phaser text objects or `textContent` only. Never `innerHTML`, `eval` or `new Function`.
- **Must run under the `vercel.json` CSP unchanged:** `default-src 'self'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'`. There's no `blob:` and no `unsafe-eval`. If something needs more, stop and report instead of loosening the policy.
- **Review gate:** a production `npm run build` includes only `reviewed` districts and scam files. With none reviewed, `/games/neon-city/` doesn't build, and the Games nav link and home tile don't appear.
- **Getting caught is never police or arrest.** No game over and no lives in platform levels. Retry starts from the same gate.
- **No unhealthy hooks:** no streaks, countdowns, random rewards or notifications.
- **Palette:** pink `#ff3d9a`, cyan `#18f0ff`, gold `#ffd166`, green `#39ff88`, on a dark background (`#07021a` to `#2b0a4d`). Use a monospace font for HUD labels and Atkinson Hyperlegible for reading text.
- **Canvas:** 16:9 logical size of 1280×720, scaled to fit with `Phaser.Scale.FIT`.
- **Boss readability:** each message card stays readable for at least 3000 ms. The fight gets harder by sending cards more often, not by moving them faster.
- **Flashing:** no more than 3 flashes per second. With reduced motion on, there's no screen shake, no flashing glitches, and the boss runs 1.5× slower.
- **Accessibility:** the game is fully playable with keyboard only, touch only or mouse only. Colour is never the only signal.
- **Done for this plan** = the game is merged with placeholder Link Alley text marked `draft`. It's playable in `npm run dev` and `npm run build:preview`, and hidden in production.

## Review Focus

1. **The `sc-progress` key is shared with the story games.** Saving game progress must keep the existing `stories` data, and corrupt JSON or blocked storage must fall back to a fresh start without crashing. *(Test in Task 2.)*
2. **Long content strings overflow small UI.** The validator caps portal labels at 32 characters, trust-or-report item text at 80, and boss message text at 60, so a reviewer's wording can't break the layout. *(Test in Task 1.)*
3. **A district can reward a draft scam file.** In production the card is filtered out, and the stash must still work with zero revealable cards by showing "More files coming soon". *(Test in Task 2; render in Task 6.)*
4. **Repeated input:** a double key-press or double tap during a gate or boss decision must count once. Resolved boss messages ignore further actions. *(Test in Task 2; guard in Tasks 5 and 6.)*
5. **An upright phone (375×812), a hidden tab or an orientation change mid-level:** reading overlays stay readable, the canvas re-fits, and play pauses while the tab is hidden. *(Check in Tasks 4 and 8.)*

---

## File Structure

```
package.json                          + phaser, vitest; "test" script
vitest.config.ts                      Vitest config (node env, tests/**/*.test.ts)
src/content.config.ts                 + gameDistricts, scamFiles collections
src/lib/content.ts                    + PublishableCollection type for getPublished
scripts/lib/game-checks.mjs           checkGameDistrict / checkScamFile (pure, testable)
scripts/validate-content.mjs          wire the game checks in
scripts/serve-with-csp.mjs            serve dist/ with the vercel.json headers (local CSP testing)
src/content/gameDistricts/link-alley.json        placeholder, draft
src/content/scamFiles/{password-grabber,fake-login-page,sneaky-peeker}.json  placeholder, draft
templates/game-district.json, templates/scam-file.json
CONTRIBUTING.md                       + "Writing a game district" section
src/game/types.ts                     content + layout types shared by game code
src/game/logic/{scoring,rounds,unlocks,progress,boss}.ts   pure rules
src/game/layouts/{alley-1,alley-2,alley-3}.json             level geometry (not reviewed content)
src/game/layouts/index.ts             typed access to the layout files
src/game/art/{palette,textures}.ts    neon colours, generated textures (Max, gates, bot)
src/game/audio/sfx.ts                 Web Audio synth effects + music loop
src/game/ui/overlays.ts               HTML reading screens (caught, clear, stash, files, map, settings)
src/game/ui/touch-controls.ts         on-screen ◀ ▶ jump buttons
src/game/shell.ts                     Shell interface + implementation (bridges scenes, overlays, progress, sfx)
src/game/scenes/{LevelScene,BossScene}.ts
src/game/main.ts                      bootNeonCity(root): parse payload, create Phaser.Game, open map
src/components/NeonCityGame.astro     shell markup + JSON payload + overlay root
src/pages/games/index.astro           Games index (EmptyState when none)
src/pages/games/[game].astro          /games/neon-city/, built only when a district is published
src/components/Header.astro           + Games nav link when published
src/pages/index.astro                 + Games tile when published
tests/game-checks.test.ts, tests/scoring.test.ts, tests/rounds.test.ts,
tests/unlocks.test.ts, tests/progress.test.ts, tests/boss.test.ts, tests/layouts.test.ts
```

---

### Task 1: Content model, validator rules and placeholder content

**Files:**
- Modify: `package.json` (devDependency `vitest`, script `"test": "vitest run"`)
- Create: `vitest.config.ts`
- Modify: `src/content.config.ts`, `src/lib/content.ts`, `scripts/validate-content.mjs`
- Create: `scripts/lib/game-checks.mjs`, `src/game/layouts/alley-1.json`, `alley-2.json`, `alley-3.json`
- Create: `src/content/gameDistricts/link-alley.json`, `src/content/scamFiles/password-grabber.json`, `fake-login-page.json`, `sneaky-peeker.json`
- Create: `templates/game-district.json`, `templates/scam-file.json`
- Modify: `CONTRIBUTING.md` (new section after "Writing a story game")
- Test: `tests/game-checks.test.ts`

**Interfaces:**
- Produces: the district JSON shape (spec §8), which Task 2 mirrors in `src/game/types.ts`. Exact fields:
  - **District:** `reviewFields` + `formatVersion: 1`, `order: number`, `habit`, `levels[]`, `boss`, `scamFileRewards: string[]`.
  - **Level:** `id`, `title`, `goal`, `habit`, `rule`, `layout`, `concept?`, `grownUpChallenge {prompt, options: string[], answer: number, explain}`, `gates[]`.
  - **Gate:** `id` and `type: 'choose-portal' | 'trust-or-report'`, plus `rounds[]`.
    - A choose-portal round is `{prompt, options: {label, safe, redFlag?}[]}`.
    - A trust-or-report round is `{prompt, item: {kind: 'link'|'message'|'popup'|'qr', text}, safe, redFlag?, whySafe?}`.
  - **Boss:** `{name, intro, waves: {messages: {text, fake, redFlag?}[]}[]}`.
  - **Scam file:** `reviewFields` + `example`, `howToSpot`, `whatToDo`, `district`, `order`.
- Produces: the layout JSON shape `{ id, width, height: 720, start: {x,y}, exit: {x,y}, platforms: {x,y,w,h, moving?: {dx, dy, periodMs}}[], gates: {x}[] }`. The validator and Task 4 read it.
- Produces: `checkGameDistrict(data: object, ctx: { layoutGateCounts: Record<string, number>, scamFileIds: Set<string>, concepts: Set<string> }): string[]` and `checkScamFile(data: object): string[]` in `scripts/lib/game-checks.mjs`. Both return error messages, with an empty array meaning valid.
- Produces: `type PublishableCollection = ReviewedCollection | 'gameDistricts' | 'scamFiles'` in `src/lib/content.ts`. `getPublished<C extends PublishableCollection>(name: C)`. `getByConcept` stays unchanged.

**Plan decision on trust-or-report:** if the player reports a **safe** item, they aren't caught. They get a gentle note using `whySafe` and must try again. This matches the over-suspicion rule in spec §6.6. So safe items require `whySafe`, and unsafe items require `redFlag`.

- [ ] **Step 1: Add Vitest.** Run `npm install -D vitest@^5.1.1`, add `"test": "vitest run"` to `scripts`, and create `vitest.config.ts` with `test: { include: ['tests/**/*.test.ts'], environment: 'node' }`.

- [ ] **Step 2: Write the failing tests** in `tests/game-checks.test.ts`. Build a valid fixture `validDistrict()` with one level of 3 gates on layout `alley-1`, 3 boss waves of 3 messages each (2 fake + 1 real per wave), and `scamFileRewards: ['password-grabber']`. Use `ctx = { layoutGateCounts: { 'alley-1': 3 }, scamFileIds: new Set(['password-grabber']), concepts: new Set(['malicious-links-qr','phishing','passwords']) }`.

```ts
it('accepts a valid district', () => expect(checkGameDistrict(validDistrict(), ctx)).toEqual([]));
it('requires exactly one safe portal', () => { /* two safe:true options */ expect(errs).toContainEqual(expect.stringMatching(/exactly one safe/)); });
it('requires redFlag on unsafe portal options', ...  /redFlag/);
it('caps portal labels at 32 characters', ...  /32 characters/);
it('requires 2 or 3 portal options', ...  /2 or 3 options/);
it('requires redFlag for unsafe trust-or-report items and whySafe for safe ones', ... /redFlag/ and /whySafe/);
it('caps trust-or-report item text at 80 characters', ... /80 characters/);
it('rejects an unknown item kind', ... /kind/);
it('rejects an unknown layout', ... /layout "nope"/);
it('requires gate count to match the layout', ... /layout "alley-1" has 3 gate slots but the level has 2 gates/);
it('requires grownUpChallenge.answer to be a valid index', ... /answer/);
it('requires exactly 3 boss waves', ... /3 waves/);
it('requires a fake and a real message in every wave', ... /wave 1 needs at least one real/);
it('requires redFlag on fake boss messages', ... /redFlag/);
it('caps boss message text at 60 characters', ... /60 characters/);
it('rejects scamFileRewards that do not exist', ... /scam file "nope" does not exist/);
it('rejects duplicate level ids and duplicate gate ids within a level', ... /duplicate/);
it('rejects an unknown level concept', ... /concept/);
it('checkScamFile requires example, howToSpot, whatToDo and district', () => expect(checkScamFile({})).toHaveLength(4));
```

- [ ] **Step 3: Run it to verify it fails.** Run `npm test`. Expected: FAIL, because `scripts/lib/game-checks.mjs` doesn't exist.

- [ ] **Step 4: Implement `checkGameDistrict` and `checkScamFile`** in `scripts/lib/game-checks.mjs`. Messages are full sentences in the same tone as the existing validator, e.g. `level "level-1", gate "gate-2", round 1: needs exactly one safe option (has 2).`

- [ ] **Step 5: Run the tests to verify they pass.** Run `npm test`. Expected: PASS.

- [ ] **Step 6: Wire the checks into `scripts/validate-content.mjs`.**
  - Add `'gameDistricts'` and `'scamFiles'` to `REVIEWED`, so review fields, the safe-string walk and concepts are checked.
  - Build `layoutGateCounts` by reading `src/game/layouts/*.json`, using `gates.length` keyed by `id`.
  - Build `scamFileIds` from the `src/content/scamFiles/` filenames.
  - Call `checkGameDistrict` and `checkScamFile` per file, and push the returned messages through `err(file, msg)`.

- [ ] **Step 7: Add Zod schemas** in `src/content.config.ts`: collections `gameDistricts` (`src/content/gameDistricts/**/*.json`) and `scamFiles` (`src/content/scamFiles/**/*.json`).
  - Both spread `reviewFields` and use `.superRefine(reviewGate)`.
  - Field shapes match the Interfaces above. Use `z.discriminatedUnion('type', …)` for gates.
  - Export both in `collections`.
  - Then extend `src/lib/content.ts` with `PublishableCollection` and widen `getPublished`.

- [ ] **Step 8: Create the three layout files** with valid geometry: `width` about 4000, a 3-gate track, platforms with gaps, and at least one moving platform in `alley-2` and `alley-3`. Task 4 tunes the values.

- [ ] **Step 9: Create placeholder content**, all marked `reviewStatus: "draft"`, `reviewer: ""`, `sources: []`, `ageLevels: ["kids"]`.
  - `link-alley.json` has `concept: "malicious-links-qr"`, `relatedConcepts: ["phishing"]`, `habit: "Check before you tap."`, and three levels:
    - **level-1, Read the address**, on `alley-1`: choose-portal gates. Use the mockup examples `library.org` / `libary.org` / `FREE-GAMES-library.win`.
    - **level-2, Who sent it?**, on `alley-2`: trust-or-report gates.
    - **level-3, Prizes and pop-ups**, on `alley-3`: a mix of both types, with `concept: "malicious-links-qr"`.
  - Every gate has 2 rounds.
  - The boss PHISH.BOT has 3 waves of at least 4 messages.
  - `scamFileRewards` lists the three scam file ids.
  - The scam files have `concept: "passwords"` and `district: "password-tower"`.
  - Add `"_note": "PLACEHOLDER TEXT - must be rewritten and expert-reviewed before rollout"` at the top of each file. Zod's default strips unknown keys, so confirm that the build accepts it.

- [ ] **Step 10: Add templates and a CONTRIBUTING section.**
  - Add `templates/game-district.json` and `templates/scam-file.json`, copied from the placeholders but trimmed to one level, one gate and one round.
  - Add a `CONTRIBUTING.md` section "Writing a game district" listing every validator rule from Step 2 in plain words.

- [ ] **Step 11: Verify.** Run `npm run validate`. Expected: `✔ Content validation passed`. Run `npm test`. Expected: PASS. Then temporarily set one link-alley portal label to 40 characters, run `npm run validate`, and expect it to fail with the 32-character message. Revert the change.

- [ ] **Step 12: Commit.** `git add -A && git commit -m "feat(game): content model, validator rules and placeholder Link Alley"`

---

### Task 2: Pure game rules

**Files:**
- Create: `src/game/types.ts`, `src/game/logic/scoring.ts`, `src/game/logic/rounds.ts`, `src/game/logic/unlocks.ts`, `src/game/logic/progress.ts`, `src/game/logic/boss.ts`
- Test: `tests/scoring.test.ts`, `tests/rounds.test.ts`, `tests/unlocks.test.ts`, `tests/progress.test.ts`, `tests/boss.test.ts`

**Interfaces:**
- Consumes: the JSON shapes from Task 1.
- Produces, in `src/game/types.ts`:
  - `PortalOption`, `ChoosePortalRound`, `TrustOrReportRound`, `GateData`, `GrownUpChallenge`, `LevelData`, `BossMessage`, `BossData`
  - `DistrictData` (`id, title, habit, order, levels, boss, scamFileRewards`)
  - `ScamFileData` (`id, title, example, howToSpot, whatToDo, district, order`)
  - `GamePayload = { districts: DistrictData[]; scamFiles: ScamFileData[] }`
  - `LayoutData` (the Task 1 layout shape)
- Produces, in `scoring.ts`: `starsFor(catches: number): 1 | 2 | 3`.
- Produces, in `rounds.ts`:
  - `pickRoundIndex(roundCount: number, previous: number | null, rng: () => number): number`
  - `shuffled<T>(items: readonly T[], rng: () => number): T[]`
  - `judgePortal(round: ChoosePortalRound, optionIndex: number): { correct: true } | { correct: false; redFlag: string }`
  - `judgeTrust(round: TrustOrReportRound, choice: 'trust' | 'report'): { outcome: 'pass' } | { outcome: 'caught'; redFlag: string } | { outcome: 'over-suspicious'; note: string }`
- Produces, in `unlocks.ts`:
  - `levelKey(districtId: string, levelId: string): string`, which returns `` `${districtId}/${levelId}` ``
  - `isLevelUnlocked(d: DistrictData, levelIndex: number, p: GameProgress): boolean`
  - `isBossUnlocked(d: DistrictData, p: GameProgress): boolean`
  - `revealableFiles(rewardIds: string[], files: ScamFileData[]): ScamFileData[]`
  - `collectionView(files: ScamFileData[], collected: string[]): { file: ScamFileData; collected: boolean }[]`
- Produces, in `progress.ts`:
  - `GameProgress = { version: 1; levels: Record<string, { cleared: boolean; bestStars: 1|2|3 }>; bosses: Record<string, { defeated: boolean }>; scamFiles: string[]; settings: { muted: boolean; reducedMotion: boolean | null } }`, where `null` means "follow the system setting"
  - `interface KV { get(key: string): string | null; set(key: string, value: string): void }`
  - `emptyProgress(): GameProgress`
  - `loadProgress(kv: KV): GameProgress`
  - `saveProgress(kv: KV, p: GameProgress): void`
  - `recordLevel(p: GameProgress, key: string, stars: 1|2|3): GameProgress`
  - `recordBoss(p: GameProgress, districtId: string, fileIds: string[]): GameProgress`
  - `resetProgress(kv: KV): void`
  - The browser passes `store` from `src/scripts/storage.ts` as the `KV`.
- Produces, in `boss.ts`:
  - `BOSS_TIMING = { maxHits: 3, travelMs: 4000, spawnEveryMs: [4000, 3200, 2500], reducedMotionFactor: 1.5 }`
  - `type BossAction = 'shield' | 'pass'`
  - `type BossEvent = 'damage' | 'bonus' | 'hit' | 'gentle-note' | 'ignored'`
  - `interface BossState { health: number; maxHealth: number; hits: number; wave: 0 | 1 | 2; status: 'fighting' | 'won' | 'caught'; caughtBy: BossMessage | null; resolved: ReadonlySet<string> }`
  - `createBoss(boss: BossData): BossState`, where `maxHealth = max(3, totalFakes - 2)`
  - `messageId(wave: number, index: number, loop: number): string`
  - `resolveMessage(s: BossState, id: string, msg: BossMessage, action: BossAction): { state: BossState; event: BossEvent }`
  - `advanceWave(s: BossState): BossState`

  Boss rules:
  - Shielding a fake gives `damage` (health −1, and health 0 means `won`).
  - Passing a real message gives `bonus` (hits −1, minimum 0).
  - Passing a fake gives `hit` (hits +1; at 3 hits, `caught` with `caughtBy = msg`).
  - Shielding a real message gives `gentle-note`.
  - An id that's already resolved, or any action when the status isn't `fighting`, gives `ignored` with the state unchanged.
  - A card that reaches Max with no decision is resolved by the scene as `'pass'`.
  - After wave index 2, the scene replays wave 2's messages shuffled with `loop + 1` until `won` or `caught`.

- [ ] **Step 1: Write the failing tests.**

```ts
// scoring
expect(starsFor(0)).toBe(3); expect(starsFor(1)).toBe(2); expect(starsFor(2)).toBe(1); expect(starsFor(9)).toBe(1);

// rounds
expect(pickRoundIndex(1, 0, () => 0.9)).toBe(0);
for (const r of [0, 0.3, 0.6, 0.99]) expect(pickRoundIndex(3, 1, () => r)).not.toBe(1);
expect(shuffled([1,2,3], seededRng(1)).sort()).toEqual([1,2,3]);           // same members
expect(judgePortal(round, safeIndex)).toEqual({ correct: true });
expect(judgePortal(round, fakeIndex)).toEqual({ correct: false, redFlag: round.options[fakeIndex].redFlag });
expect(judgeTrust(unsafeItem, 'trust')).toEqual({ outcome: 'caught', redFlag: unsafeItem.redFlag });
expect(judgeTrust(unsafeItem, 'report')).toEqual({ outcome: 'pass' });
expect(judgeTrust(safeItem, 'report')).toEqual({ outcome: 'over-suspicious', note: safeItem.whySafe });

// unlocks
expect(isLevelUnlocked(d, 0, emptyProgress())).toBe(true);
expect(isLevelUnlocked(d, 1, emptyProgress())).toBe(false);
expect(isLevelUnlocked(d, 1, withCleared('link-alley/level-1'))).toBe(true);
expect(isBossUnlocked(d, withCleared(...all three))).toBe(true);
expect(revealableFiles(['a','draft-only'], [fileA])).toEqual([fileA]);       // Review Focus 3
expect(revealableFiles(['draft-only'], [])).toEqual([]);
expect(collectionView([fileB(order 2), fileA(order 1)], ['b'])).toEqual([{file: fileA, collected: false}, {file: fileB, collected: true}]);

// progress (fake KV backed by a Map)
expect(loadProgress(kv({}))).toEqual(emptyProgress());
expect(loadProgress(kv({ 'sc-progress': '{not json' }))).toEqual(emptyProgress());
expect(loadProgress(kv({ 'sc-progress': '{"games":{"neonCity":{"version":99}}}' }))).toEqual(emptyProgress());
expect(loadProgress(throwingKv())).toEqual(emptyProgress());                 // storage blocked
saveProgress(k, recordLevel(emptyProgress(), 'link-alley/level-1', 2));
expect(JSON.parse(k.get('sc-progress')!).stories).toEqual(existingStories);  // Review Focus 1: story progress kept
expect(recordLevel(recordLevel(p, key, 3), key, 1).levels[key].bestStars).toBe(3);
expect(recordBoss(p, 'link-alley', ['a','a','b']).scamFiles).toEqual(['a','b']);
expect(() => saveProgress(throwingKv(), emptyProgress())).not.toThrow();
resetProgress(k); expect(JSON.parse(k.get('sc-progress')!).stories).toEqual(existingStories);
expect(JSON.parse(k.get('sc-progress')!).games?.neonCity).toBeUndefined();

// boss (fixture: 3 waves x 3 msgs, 2 fakes each -> 6 fakes -> maxHealth 4)
expect(createBoss(b).maxHealth).toBe(4);
expect(resolveMessage(s, 'w0-0-0', fake, 'shield').event).toBe('damage');
expect(resolveMessage(s, 'w0-0-0', fake, 'pass').state.hits).toBe(1);
expect(resolveMessage(s, 'w0-2-0', real, 'pass').event).toBe('bonus');
expect(resolveMessage(s, 'w0-2-0', real, 'shield').event).toBe('gentle-note');
// three fakes passed -> caught with caughtBy = third fake
// four fakes shielded -> status 'won'
const once = resolveMessage(s, 'w0-0-0', fake, 'shield').state;
expect(resolveMessage(once, 'w0-0-0', fake, 'shield').event).toBe('ignored');  // Review Focus 4
expect(resolveMessage(wonState, 'w1-0-0', fake, 'shield').event).toBe('ignored');
expect(advanceWave(advanceWave(advanceWave(s))).wave).toBe(2);               // clamps at 2
```

- [ ] **Step 2: Run them to verify they fail.** Run `npm test`. Expected: FAIL with "Cannot find module" errors for `src/game/logic/*`.

- [ ] **Step 3: Implement `types.ts` and the five logic modules** with the exact signatures above. The modules have no Phaser and no DOM imports, and `rng` is always injected. `loadProgress` reads `sc-progress`, takes `games.neonCity`, and accepts it only when `version === 1` with the right field types. Anything else returns `emptyProgress()`.

- [ ] **Step 4: Run the tests to verify they pass.** Run `npm test`. Expected: PASS for all suites.

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat(game): pure rules for scoring, rounds, unlocks, progress and boss"`

---

### Task 3: Game pages, nav visibility and the Phaser mount

**Files:**
- Modify: `package.json` (dependency `phaser@^4.2.1`)
- Create: `src/pages/games/index.astro`, `src/pages/games/[game].astro`, `src/components/NeonCityGame.astro`, `src/game/main.ts`, `scripts/serve-with-csp.mjs`
- Modify: `src/components/Header.astro`, `src/pages/index.astro`
- Test: `tests/build-visibility.sh` (shell check run in verification steps)

**Interfaces:**
- Consumes: `getPublished('gameDistricts' | 'scamFiles')` (Task 1) and `GamePayload` (Task 2).
- Produces: `bootNeonCity(root: HTMLElement): void` in `src/game/main.ts`. It reads the `<script type="application/json" data-game-payload>` inside `root` with `JSON.parse`, and mounts Phaser into `[data-game-canvas]`. Overlays mount into `[data-game-overlay]` and touch controls into `[data-game-touch]`. In this task the scene list is a placeholder that draws the dark background and the text "NEON CITY". Task 4 replaces it.
- Produces: the markup contract in `NeonCityGame.astro`:
  - `[data-game-root]` contains `[data-game-canvas]`, `[data-game-overlay]` (with `aria-live="polite"` on a child `[data-game-live]`), `[data-game-touch]`, and `<noscript>`.
  - The payload is `JSON.stringify(payload).replace(/</g, '\\u003c')`, the same as `StoryPlayer.astro`.
- Produces: `node scripts/serve-with-csp.mjs [port=4322]` serves `dist/` with the exact headers from `vercel.json`.

- [ ] **Step 1: Write the visibility check** in `tests/build-visibility.sh`. Given a `dist/` folder and an expected `present|absent` argument, it checks whether `dist/games/neon-city/index.html` exists, and greps `dist/index.html` for `href="/games/"`. It exits non-zero on a mismatch.

- [ ] **Step 2: Run it to verify it fails.** Run `npm run build:preview && bash tests/build-visibility.sh present`. Expected: FAIL, because there's no games page yet.

- [ ] **Step 3: Install Phaser and implement the pages.**
  - Run `npm install phaser@^4.2.1`.
  - **`[game].astro`:** `getStaticPaths` returns `[{ params: { game: 'neon-city' }, props }]` only when `getPublished('gameDistricts')` is non-empty, and `[]` otherwise. The props carry the districts sorted by `order` and the published scam files. Each district's `id` is the entry id.
  - **Page contents:**
    - `Breadcrumbs` (Games → Neon City)
    - a `ReviewBanner` with status `'draft'` if any embedded district or scam file isn't `reviewed`
    - an `h1` and a one-paragraph note for parents saying what the game teaches
    - `<NeonCityGame payload={…} />`
    - `Sources` (merged from the districts)
    - `RelatedContent` for the first district's `concept`
  - **`index.astro` under games:** lists Neon City as a tile when published, and `<EmptyState what="games" />` otherwise.
  - **`Header.astro`:** insert `{ href: '/games/', label: 'Games' }` after Story Games only when `(await getPublished('gameDistricts')).length > 0`.
  - **`src/pages/index.astro`:** add the tile `{ href: '/games/', emoji: '🕹️', title: 'Games', text: 'Help Max cross Neon City and outsmart the scam bots.' }` under the same condition.

- [ ] **Step 4: Implement `bootNeonCity`** with a placeholder scene, and mount it from a `<script>` in `NeonCityGame.astro` (`import { bootNeonCity } from '../game/main'`). Use `Phaser.AUTO`, `scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 }`, and `backgroundColor: '#07021a'`.

- [ ] **Step 5: Implement `scripts/serve-with-csp.mjs`** using `node:http` and `node:fs`. It parses `vercel.json` headers for `/(.*)`, serves files from `dist/` with directory `index.html` and the right content types, and sends those headers on every response.

- [ ] **Step 6: Verify.**
  - `npm run build:preview && bash tests/build-visibility.sh present` → PASS.
  - `npm run build && bash tests/build-visibility.sh absent` → PASS, because the drafts are excluded.
  - `npm run build:preview && node scripts/serve-with-csp.mjs`, then open `http://localhost:4322/games/neon-city/`. The canvas should show "NEON CITY", and the browser console should show **no CSP errors**. If Phaser itself trips the CSP, stop and report (Global Constraints).
  - Check that the JS for `/games/neon-city/` contains Phaser, and that `/stories/` doesn't load it (inspect the network panel or the `dist/_astro` chunk imports).

- [ ] **Step 7: Commit.** `git add -A && git commit -m "feat(game): games pages, nav visibility, Phaser mount and CSP test server"`

---

### Task 4: Neon City art, Max and platforming

**Files:**
- Create: `src/game/art/palette.ts`, `src/game/art/textures.ts`, `src/game/layouts/index.ts`, `src/game/scenes/LevelScene.ts`, `src/game/ui/touch-controls.ts`
- Modify: `src/game/main.ts`, `src/game/layouts/alley-*.json` (tune)
- Test: `tests/layouts.test.ts`

**Interfaces:**
- Consumes: `LayoutData` and `LevelData` (Task 2), and `bootNeonCity` (Task 3).
- Produces:
  - `PALETTE` (Global Constraints colours plus `bg0 '#07021a'`, `bg1 '#2b0a4d'`, `danger '#ff2e63'`) and `createTextures(scene: Phaser.Scene): void`. The latter generates the texture keys `max-idle`, `max-run-0..3`, `max-jump`, `gate-active`, `gate-cleared`, `gate-locked`, `portal`, `phishbot`, `cage` and `spark` with `Graphics.generateTexture`. No image files.
  - `getLayout(id: string): LayoutData` and `LAYOUT_IDS: string[]`.
  - `LevelScene`, started with `{ districtId: string; levelIndex: number }`. It emits `'gate-reached'` with `gateIndex: number` on the scene's `events`, and listens for `'gate-opened'`. Task 5 wires both.
  - `mountTouchControls(el: HTMLElement): { left(): boolean; right(): boolean; jump(): boolean; destroy(): void }`.
- **Movement and visual values** (tunable, but start here):
  - Gravity: 1400.
  - Run speed: 260.
  - Jump velocity: −620.
  - Coyote time: 100 ms.
  - Jump buffer: 100 ms.
  - Camera follows Max with lerp 0.1.
  - Parallax skyline at 0.3 speed.
  - Grid floor and glowing floor line as in the mockup.

- [ ] **Step 1: Write the failing layout tests.**
  - Every id in `LAYOUT_IDS` loads.
  - Gates are sorted by `x` and lie between `start.x` and `exit.x`.
  - A platform sits under `start` and under every gate (`platform.y > point.y` and `x` within `[p.x, p.x + p.w]`).
  - No gap between consecutive platforms is wider than 220 px, so every gap is jumpable at the speeds above.

- [ ] **Step 2: Run it to verify it fails.** Run `npm test`. Expected: FAIL, because `src/game/layouts/index.ts` doesn't exist.

- [ ] **Step 3: Implement `layouts/index.ts`** (static JSON imports) and tune the layout files until the tests pass. Run `npm test`. Expected: PASS.

- [ ] **Step 4: Implement the art, `LevelScene` and touch controls.**
  - **Max:** runs with arrow keys / A-D and jumps with Space / Up / W, or with the touch buttons.
  - **Gates:** solid until opened. Touching an active gate's trigger zone emits `'gate-reached'` once.
  - **Falling:** below `height + 100`, Max respawns at the last opened gate (or `start`).
  - **Exit:** reaching `exit` emits `'level-exit'`.
  - **Pausing:** pause on `document.visibilitychange` when hidden.
  - **Reduced motion:** if `reducedMotion` is true (from `matchMedia('(prefers-reduced-motion: reduce)')` until settings exist in Task 7), skip camera shake and particle bursts.
  - **Glow:** use Phaser's built-in glow filter where it works under the CSP. Otherwise use layered translucent strokes.
  - **Touch controls:** show them when `matchMedia('(pointer: coarse)')` matches, below the canvas when it's letterboxed and overlaid in landscape.
  - **Rotate hint:** on a coarse pointer in portrait, show a dismissible hint "Turn your phone sideways for the best view". The game still plays letterboxed if it's dismissed (spec §7).

- [ ] **Step 5: Verify in the browser.**
  - Run `npm run dev` and open `/games/neon-city/`. For now, `main.ts` starts `LevelScene` with `{ districtId: 'link-alley', levelIndex: 0 }`.
  - At desktop size and at 375×812 (mobile preset), run, jump, fall into a gap to check the respawn, and reach the exit. Confirm the gates block Max.
  - Hide the tab and come back: play should be paused.
  - Rotate between 812×375 and 375×812: the canvas should re-fit.
  - There should be no console errors.

- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(game): Neon City art, Max platforming and level layouts"`

---

### Task 5: Gates, Caught and Level Clear

**Files:**
- Create: `src/game/ui/overlays.ts`, `src/game/shell.ts`
- Modify: `src/game/scenes/LevelScene.ts`, `src/game/main.ts`, `src/components/NeonCityGame.astro` (overlay styles)

**Interfaces:**
- Consumes: `pickRoundIndex`, `shuffled`, `judgePortal`, `judgeTrust`, `starsFor`, `recordLevel`, `levelKey`, `loadProgress`/`saveProgress` (Task 2), and `LevelScene` events (Task 4).
- Produces: `interface Shell` in `src/game/shell.ts`, built by `createShell(root: HTMLElement, payload: GamePayload, kv: KV)` and stored in `game.registry.set('shell', shell)`:

```ts
interface Shell {
  payload: GamePayload;
  progress(): GameProgress;
  update(fn: (p: GameProgress) => GameProgress): void;   // applies + saves
  reducedMotion(): boolean;                              // settings value, else system preference
  sfx(name: SfxName): void;                              // no-op until Task 7
  showCaught(o: { botName: string; redFlag: string; retryLabel: string }): Promise<void>;
  showNote(text: string): Promise<void>;
  showLevelClear(o: { stars: 1|2|3; rule: string; challenge: GrownUpChallenge; hasNext: boolean }): Promise<'next' | 'replay' | 'map'>;
  showStash(files: ScamFileData[], nextDistrictLabel: string): Promise<void>;  // Task 6
  openMap(): void;                                                              // Task 7
}
type SfxName = 'jump' | 'gate' | 'caught' | 'hit' | 'damage' | 'clear' | 'click';
```

- **Overlays:**
  - Built only with `document.createElement` and `textContent`. Each overlay gets `role="dialog"`, `aria-modal="true"`, and focus on its first button. Escape is ignored, because every screen has an explicit button.
  - Styling uses the Neon City palette, with font sizes in `rem` so the site's `--text-scale` applies, and `:root[data-contrast='high']` overrides.
  - Overlays fill the viewport below 768 px width, and sit centred over the canvas above that.
- **Gate UI in canvas:**
  - The prompt sits at the top in a monospace font.
  - Portals are laid out from the shuffled options, with labels in Atkinson Hyperlegible and at least 22 px at 1280 width.
  - Number badges 1–3 support keyboard selection. Arrows plus Enter also work, as does a click or tap on a portal.
  - Trust-or-report shows the item card with a kind icon (🔗 link, 💬 message, 🪟 pop-up, ▦ QR) and two portals labelled "✔ TRUST" and "⚑ REPORT".
- **Input lock:** after a choice, input is locked until the outcome animation and overlay resolve (Review Focus 4). Max is placed beside the portals, never in front of one.
- **Flow:**
  - **Correct:** a success burst, then `'gate-opened'`.
  - **Caught:** `catches += 1`, `shell.showCaught({ botName: 'PHISH.BOT', redFlag, retryLabel: 'RETRY GATE_0N' })`, then a new round via `pickRoundIndex(…, previous)` with the options reshuffled.
  - **Over-suspicious:** `shell.showNote(note)`, the same round stays, and catches are unchanged.
  - **Exit:** `stars = starsFor(catches)`, `shell.update(p => recordLevel(p, levelKey(d, l), stars))`, then `showLevelClear`.
- **Level clear overlay:**
  - stars (★ glyphs plus visually hidden text "2 of 3 stars")
  - the `rule` as a command-style line
  - the grown-up card: the prompt and options as buttons. Tapping any of them flips the card, revealing the `answer` (marked with a text label, not colour alone) and `explain`.
  - buttons for Next level (when `hasNext`), Replay and Map

- [ ] **Step 1: Implement the overlays and the shell**, using the signatures above.
- [ ] **Step 2: Implement the gate challenges and flow** in `LevelScene`, using the rules above.
- [ ] **Step 3: Verify in the browser** (`npm run dev`, then `/games/neon-city/`, desktop and 375×812):
  - Each gate type works by keyboard only, by mouse only and by touch only.
  - A wrong portal shows Caught with that option's red flag, and the retry stays at the same gate with a different round.
  - Reporting a safe item shows the gentle note.
  - Pressing `1` rapidly five times on a wrong portal produces one Caught, not five.
  - Level clear shows the correct stars (finish once with 0 mistakes and once with 2).
  - `localStorage['sc-progress']` contains `games.neonCity.levels['link-alley/level-1']`, and any existing `stories` key is still there.
  - With site text size set to "largest" and contrast "high" (the site's reading tools), the overlay text scales and switches contrast.
- [ ] **Step 4: Commit.** `git add -A && git commit -m "feat(game): gate challenges, caught and level-clear screens"`

---

### Task 6: PHISH.BOT boss, stash and Scam Files

**Files:**
- Create: `src/game/scenes/BossScene.ts`
- Modify: `src/game/ui/overlays.ts` (stash + Scam Files screens), `src/game/shell.ts`, `src/game/main.ts`

**Interfaces:**
- Consumes: `createBoss`, `resolveMessage`, `advanceWave`, `messageId`, `BOSS_TIMING`, `shuffled`, `recordBoss`, `revealableFiles`, `collectionView` (Task 2), and `Shell` (Task 5).
- Produces:
  - `BossScene`, started with `{ districtId: string }`.
  - `Shell.showStash(files, nextDistrictLabel)`.
  - `Shell.showScamFiles(): void`, which opens the collection overlay.
- **Layout:**
  - PHISH.BOT is on the right with a health bar (`health/maxHealth`, plus text "PHISH.BOT 3/4").
  - Max is on the left with a shield and a hits indicator (3 shield pips, plus text).
  - Message cards spawn at the bot every `spawnEveryMs[wave]`. They travel to Max over `travelMs`, both × `reducedMotionFactor` when reduced motion is on.
  - Card text is in Atkinson Hyperlegible, at least 22 px.
  - The two big buttons are **🛡 SHIELD** (key S or ←) and **✔ LET IT THROUGH** (key L or →), both on-screen and tappable. They act on the card nearest Max.
- **Waves:** move on with `advanceWave` when a wave's messages are all resolved. After wave 2, replay its messages shuffled with `loop + 1` until the fight is won or Max is caught.
- **Outcomes:**
  - `damage`: the card reflects back at the bot and sparks fly.
  - `hit`: a shield crack, with screen shake unless reduced motion is on.
  - `bonus`: a pip is restored.
  - `gentle-note`: a small inline toast "That one was real", with no pause.
  - `caught`: `shell.showCaught({ botName, redFlag: caughtBy.redFlag, retryLabel: 'RETRY BOSS' })`, then the boss restarts from `createBoss`.
  - `won`: a glitch-out animation (≤ 3 flashes/s), then `files = revealableFiles(d.scamFileRewards, payload.scamFiles)`, `shell.update(p => recordBoss(p, d.id, files.map(f => f.id)))`, then `shell.showStash(files, 'Password Tower')`.
- **Stash overlay:** reveals the files one at a time with a "Next file" button. Each card shows the title, the example (styled as a message), "How to spot it" and "What to do". With zero files it shows "More files coming soon" (Review Focus 3). It ends with a "Coming soon: Password Tower" teaser.
- **Scam Files overlay:** a grid from `collectionView(payload.scamFiles, progress.scamFiles)`. Collected cards open in full. Uncollected cards are locked silhouettes labelled "Locked: beat a boss to unlock", with the label in text, not just greyed out.

- [ ] **Step 1: Implement `BossScene`, the stash and the Scam Files overlays**, using the rules above.
- [ ] **Step 2: Verify in the browser** (`npm run dev`; temporarily start `BossScene` from `main.ts`):
  - Shield every fake → the bot is defeated and the stash shows 3 placeholder files.
  - Let 3 fakes through → Caught shows the third fake's red flag, and the retry restarts the fight.
  - Pressing S ten times rapidly resolves only the current card.
  - With reduced motion forced on, cards travel 1.5× slower and there's no shake.
  - Each card stays on screen for at least 3 seconds before reaching Max. Measure with `performance.now()` logging in dev, then remove the logging.
  - After setting one placeholder scam file to a non-existent id in `scamFileRewards` locally, the stash still works. Revert afterwards.
  - The Scam Files overlay shows collected and locked cards.
- [ ] **Step 3: Commit.** `git add -A && git commit -m "feat(game): PHISH.BOT boss fight, stash reveal and Scam Files"`

---

### Task 7: District map, settings and sound

**Files:**
- Create: `src/game/audio/sfx.ts`
- Modify: `src/game/ui/overlays.ts` (map + settings), `src/game/shell.ts`, `src/game/main.ts`, `src/game/scenes/LevelScene.ts`, `src/game/scenes/BossScene.ts`

**Interfaces:**
- Consumes: `isLevelUnlocked`, `isBossUnlocked`, `resetProgress` (Task 2), and `Shell` (Tasks 5 and 6).
- Produces: `createSfx(): { unlock(): void; play(name: SfxName): void; setMuted(m: boolean): void; startMusic(): void; stopMusic(): void }`.
  - It uses only Web Audio oscillators and noise buffers: no audio files, so no licensing and no CSP impact.
  - `unlock()` creates or resumes the `AudioContext` on the first pointer or key event.
  - The music is a quiet synth arpeggio loop at gain ≤ 0.08.
- Produces: `Shell.openMap()` (the real implementation) and `Shell.sfx`, which is now wired.
- **Map overlay** (the screen `bootNeonCity` opens first):
  - The district title and umbrella habit.
  - Level 1–3 buttons, each showing its title, its habit and its best stars as text. Locked levels are disabled, with the text "Locked: clear the level before".
  - A boss button: "PHISH.BOT", locked until all 3 levels are cleared, then "Defeated ✔" once beaten.
  - A "Scam Files (n/total)" button.
  - A "Coming soon: Password Tower" card.
  - Settings ⚙.
- **Settings overlay:**
  - Sound on/off.
  - Reduced motion: Follow device / On / Off (maps to `null` / `true` / `false`).
  - "Reset game progress", which asks "Reset all Neon City progress? Your story game progress is kept." with Cancel and Reset buttons, then calls `resetProgress` and reloads the map.
- **Mute:** a 🔊/🔇 mute button is always visible in the top-right corner of the game root, as an HTML button with `aria-pressed`. It's persisted in `settings.muted`.

- [ ] **Step 1: Implement `sfx.ts`, the map and settings overlays, and the always-visible mute button.** Wire `shell.sfx(...)` calls at jump, gate opened, caught, boss hit, boss damage, level clear and button clicks.
- [ ] **Step 2: Verify in the browser:**
  - The fresh-start map shows only Level 1 unlocked.
  - Clearing levels unlocks the next one, and then the boss.
  - The best stars persist across a page reload.
  - Mute persists across a reload.
  - There's no sound before the first interaction, and no console warnings about AudioContext.
  - Reset keeps `sc-progress.stories` and clears the game progress.
  - "Reduced motion: On" slows the boss.
  - In a private window with storage blocked (or `localStorage.setItem` stubbed to throw in devtools), the game still plays and simply doesn't remember progress.
- [ ] **Step 3: Commit.** `git add -A && git commit -m "feat(game): district map, settings, sound and mute"`

---

### Task 8: Full verification pass

**Files:**
- Modify: only files needed to fix problems found here.
- Modify: `README.md` (add Games to the feature list and `npm test` to the commands table).

- [ ] **Step 1: Automated checks.** Run `npm test` (expected: all suites PASS) and `npm run validate` (expected: `✔ Content validation passed`).
- [ ] **Step 2: Production hides the game.** Run `npm run build && bash tests/build-visibility.sh absent`. Expected: PASS. Also confirm that `/games/` builds and shows the EmptyState.
- [ ] **Step 3: Preview under the real CSP.** Run `npm run build:preview && node scripts/serve-with-csp.mjs`. Play Link Alley end to end: all 3 levels, the boss, the stash, the Scam Files screen and the map. Expected: no CSP violations or errors in the browser console.
- [ ] **Step 4: Devices and inputs.** Repeat the playthrough:
  - at 1280×720 with keyboard only
  - at 1280×720 with mouse only
  - at 375×812 (upright) and 812×375 (landscape) with touch only. Reading overlays must be fully readable upright (Review Focus 5).
- [ ] **Step 5: Accessibility checks.**
  - Tab through every overlay: focus is always visible and lands on the first button.
  - With colour removed (devtools "achromatopsia" emulation), safe/unsafe, stars and locked states are still understandable.
  - With reduced motion on, there's no shake and no flashing, and the boss runs slower.
  - Overlay text contrast passes WCAG AA (check with devtools).
- [ ] **Step 6: Bundle check.** Confirm that Phaser is loaded only on `/games/neon-city/`. Record the gzipped size of its chunk in the PR description.
- [ ] **Step 7: Update README and commit.** `git add -A && git commit -m "docs: add Neon City game to README; verification fixes"`
