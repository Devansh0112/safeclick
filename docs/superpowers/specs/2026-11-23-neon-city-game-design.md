# Neon City: SafeClick's first game (design)

**Date:** 2026-11-23
**Status:** Draft, waiting for the project owner's approval
**Background:** [brainstorm notes](2026-11-23-neon-city-game-brainstorm.md) and [mockups](../mockups/game-look-dark.html)

Decisions marked **(decided)** came from the project owner. Ones marked **(designer's call)** were made while writing this doc and can still be changed. Anything not listed is left to the builder (see the last section).

---

## 1. Intent

SafeClick teaches people of every age to stay safe online. This is its first real game, built for the **Kids** audience.

Kids should play because it's fun and they want to come back, not because it feels like a lesson. Every level leaves them with **one specific security habit**, learned by playing, because the habit is how you win. We'll know it worked when kids repeat a habit to a parent or a friend without being asked.

**Player:** ages 8 to 12, who can read short signs. **(designer's call)** Icons mark the *kind* of item (link, message, pop-up, QR code) and the action buttons (Trust/Report, Shield/Let it through). Answer options never carry an icon that hints at the answer. Younger kids can play next to a parent who reads the labels aloud. Gates about spelling in web addresses aren't meant to work for kids who can't read yet.

## 2. Definition of done (decided)

This build is **done when the whole game is built, tested and merged, with placeholder Link Alley text marked `draft`**. It's playable in `npm run dev` and `npm run build:preview`, and hidden on the live site: no page, no nav link, no home tile.

Rolling out to the public is a **separate step after this build**. The project owner plays and reviews the game first. Then the real Link Alley text is written and expert-reviewed, and the district is marked `reviewed`. Nothing in this build depends on that step.

## 3. Goals, non-goals, anti-goals

**Goals for the first release**
- One complete district, **Link Alley**, with 3 platform levels, a boss fight (PHISH.BOT) and the first Scam Files cards.
- **Each level teaches its own habit** (decided: "a specific security habit at each level"). The three habits sit under the district's umbrella habit, **"Check before you tap."** Placeholder habits for Link Alley **(designer's call)**:
  1. **Level 1, Read the address:** every letter counts (look-alike web addresses). Mostly *choose the portal* gates.
  2. **Level 2, Who sent it?:** a link in an unexpected message, even from a "friend" or a "game company", is a reason to stop. Mostly *trust or report* gates.
  3. **Level 3, Prizes and pop-ups:** "You won!" pop-ups and unknown QR codes are traps. A mix of both gate types, at the hardest difficulty.

  Difficulty also rises from level to level in both platforming and how subtle the fakes are.
- Fun enough that a kid asks to play again, and polished enough to feel like a "real" game.
- Every bit of teaching text goes through SafeClick's existing expert-review gate.
- Runs well on phones, tablets and computers.

**Non-goals for now**
- The other five districts and the final boss. The design must make them easy to add later, but they aren't built now.
- Accounts, names, cloud saves, leaderboards, multiplayer, chat.
- Sharing to social media.
- Voice-over or read-aloud.
- A level editor.

**Anti-goals (failure even if it "works")**
- Any tracking, analytics, cookies, third-party requests or personal data. Children use this site.
- Unhealthy hooks: guilt-trip streaks, timers that push kids to come back, loot boxes, anything that feels like gambling.
- Making a kid feel stupid or in trouble when they're tricked. Getting caught is the scam bot's trick, never the kid's crime. No police or arrests.
- Violence beyond cartoon zaps, or anything frightening for an 8-year-old.
- Teaching text that bypasses expert review.
- A quiz with a game painted on top. If you can remove the game and the lesson still works the same way, the design has failed.

## 4. Constraints (from the existing site)

- **Stack:** Astro 7, static output, deployed on Vercel. Node ≥ 22.12. Code is MIT, content is CC BY 4.0.
- **Privacy:** no cookies, analytics or trackers. Progress lives only in the browser via the existing `sc-progress` localStorage key (`STORAGE_KEYS.progress` in `src/site.config.ts`). Wrap every access in try/catch, like `src/scripts/storage.ts`, so the game still works when storage is blocked.
- **Review gate:** content files carry `reviewFields` and the `reviewGate` refinement from `src/content.config.ts`. A production `npm run build` includes only `reviewed` content (`src/lib/content.ts` → `getPublished`). Dev and `build:preview` show drafts with a `ReviewBanner`.
- **Content is data, never code.** `scripts/validate-content.mjs` rejects HTML, scripts and `javascript:` links in any content string. The game must render content text as plain text only: Phaser text objects or `textContent`, never `innerHTML`.
- **Content Security Policy** (`vercel.json`): `script-src 'self' 'unsafe-inline'`, `img-src 'self' data:`, `connect-src 'self'`. There's no `unsafe-eval` and no `blob:`. The game must run under this policy. If a Phaser feature needs the policy loosened (e.g. `blob:` in `img-src`), avoid that feature, or add only the narrowest addition and say why in the PR.
- **No CDNs.** Phaser is installed from npm and bundled by Astro/Vite, and it loads only on the game page.

## 5. Approaches considered

| Approach | Trade-off | Outcome |
|---|---|---|
| **Phaser** (free, open-source 2D game library, MIT) | Physics, collisions, sprites, particles, glow effects, sound, input and scaling built in. Adds roughly 1 MB of JS (about 350 KB gzipped), on the game page only. | **Chosen** by the project owner. The boss fight and the neon polish are exactly what Phaser is good at, and the extra size is limited to the one page. |
| Plain JavaScript on a canvas | Tiny with no dependency, but physics, animation, particles, input and scaling all have to be built by hand. | Rejected: much slower to reach "feels like a real game," especially for the boss fight. |
| Kaplay (lighter library) | Smaller and simpler, but a smaller community and weaker effects for the neon look. | Rejected. |

Use the current stable Phaser major version when the build starts. **(designer's call)**

## 6. The experience

### 6.1 Look: Neon City (decided)

- A synthwave night city: dark sky, glowing grid floor, and pink (#ff3d9a), cyan (#18f0ff), gold (#ffd166) and green (#39ff88) neon. The mockups show the palette and mood.
- **Max** is a young cyber-guardian in a dark hoodie with a glowing cyan visor. He's a defender, not a hacker breaking in.
- Villains are glitchy **scam bots**. Link Alley's is **PHISH.BOT**: a screen-faced bot with a hook arm and a red glitch.
- HUD text uses a code-style monospace font and short, punchy labels, e.g. `GATE_02 // FIND THE REAL LIBRARY`. Longer reading text, like red flags, rules and Scam Files, uses the site's readable font (Atkinson Hyperlegible, already installed). **(designer's call: readability for kids beats style on anything longer than a label)**
- **Art is made in code** for the first release: vector shapes, Phaser graphics, glow effects and particles. No commissioned sprite sheets are needed. The neon look suits this, and it avoids licensing and asset-pipeline work. Swapping in drawn sprites later is allowed. **(designer's call)**
- **Sound:** short synth effects for jump, gate cleared, caught, boss hit and level clear, plus a simple background loop. Use only sounds we make ourselves or CC0 sounds, with credits in the repo. A mute button is always visible and the setting is remembered. Sound starts after the player's first tap, as browsers require. **(designer's call)**

### 6.2 Structure (decided)

```
Neon City
└── District (e.g. Link Alley)       one habit theme, one boss
    ├── Level 1  ── Gate ── Gate ── Gate ──▶ exit
    ├── Level 2  ── …
    ├── Level 3  ── …
    └── Boss     ── fight ──▶ open the stash ──▶ Scam Files
```

Levels unlock in order and the boss unlocks after Level 3. Any cleared level can be replayed.

### 6.3 A platform level

- Max runs and jumps left to right from the start (A) to the exit portal (B). A level takes about 1 to 3 minutes.
- Between gates is a short platforming run: jumps, gaps and moving platforms. Falling into a gap respawns Max at the last gate he passed, with no penalty. This part is the fun, not the lesson.
- **Gates** are glowing arches that block the path. When Max reaches one, play pauses and the gate challenge opens (6.4).
- **Level clear** (decided): show a star rating, then the level's **rule** (a single line, e.g. "Read the address. Every letter counts."), then the **Challenge a grown-up** card. That card is a mini "spot the fake" the kid shows a parent, and they tap to flip it and reveal the answer.
- **Stars** (designer's call): 3 stars for no catches, 2 for one catch, 1 for more. Only security mistakes count. Falling off a platform doesn't affect stars. Players keep their best result.

### 6.4 Gate challenges

A gate challenge *is* the habit. The first release has two gate types **(designer's call)**:

1. **Choose the portal.** The prompt names Max's goal ("Max needs the real Library"). Two or three portals each carry a label, such as a web address or a sender name. Exactly one is safe. Max walks through the one the player taps or selects.
2. **Trust or report.** One item appears, such as a link, a pop-up or a short message. The player sends it to the **Trust** portal or the **Report** portal.

Rules for both types:
- Choices can be made by tapping, by mouse, or with keys 1, 2 and 3 and arrows plus Enter.
- Max never stands in a spot that hints at the answer, and portal order is shuffled each time.
- Each gate has **one or more rounds** in the content file. A retry uses a different round when one exists, so kids can't win by memorising positions.
- A correct choice gives a short success burst and the gate opens.
- A wrong choice triggers **Caught**.

### 6.5 Caught (decided)

- The scam bot traps Max in a "data cage," with a red glitch effect and a cartoon tone, never frightening.
- One plain-language line names the red flag that was missed, taken from the wrong option's `redFlag` text, e.g. "libary.org is missing an 'r'. Fakes copy real names and change one letter."
- **Retry starts from that gate**, not from the beginning of the level.
- There's no game over and no lives in platform levels.

### 6.6 Boss fight: PHISH.BOT (decided in principle; mechanics are the designer's call)

The fight is the habit practised at speed.

- PHISH.BOT stands at the right side of the screen with a health bar. Max stands on the left with a **shield**.
- The boss fires **message cards** that drift toward Max, such as "Your account is LOCKED! Tap here" or "Mum: Home by 6 tonight?". Each card is either **fake** or **real**, as defined in the content file.
- For each card the player chooses **Shield** (block it) or **Let it through** (catch it), using on-screen buttons or keys.
  - **Shielding a fake** reflects it back at the boss and does damage.
  - **Letting a real one through** earns a small bonus that restores one hit of protection.
  - **Letting a fake through** hits Max.
  - **Shielding a real one** shows a gentle "That one was real" note with no damage. Being overly suspicious isn't punished like being tricked, but it isn't rewarded either.
- After 3 hits, Max is caught. The caught screen shows the red flag of the fake that got through, then the player retries the boss from the start of the fight.
- **Readability matters more than speed.** Each card must stay readable for at least 3 seconds before a decision is due. The fight speeds up over 3 waves by sending cards more often, not by moving them faster. The "reduced motion" setting slows everything down.
- **Defeat:** PHISH.BOT glitches out and crashes. There's no gore and no "death."

### 6.7 The stash and Scam Files (decided)

- After the win, Max **opens PHISH.BOT's stash**: a short, satisfying reveal of 3 or 4 files, one at a time.
- Each file is a **Scam File card**:
  - the trick's name
  - an example of the trap, such as a fake text or a fake login page
  - how to spot it
  - what to do instead
- These cards preview the traps of the **next district**. In the first release, Password Tower is shown as "Coming soon."
- A **Scam Files** screen, opened from the game menu, shows every collected card. Uncollected cards appear as locked silhouettes so kids want to fill the set.
- The same cards should be printable later as a parent handout. That isn't required for the first release, but the card format shouldn't make it hard.

### 6.8 Healthy "come back" design (decided)

- **Allowed:** unlocking levels, stars, beating your own best, collecting Scam Files, "Coming soon" teasers.
- **Not allowed:** daily streaks, countdowns, "your friends are ahead," random rewards, or notifications of any kind.

## 7. Where it lives on the site **(designer's call)**

- A new page at **`/games/neon-city/`** hosts the game.
- **`/games/`** is an index page, ready for future games. Add "Games" to the header nav next to Story Games, and give the game a tile on the home page.
- The page shows:
  - the game canvas, sized 16:9 and scaled to fit
  - a short line for parents explaining what the game teaches
  - links to SafeClick cards and stories on the same concepts (reuse `RelatedContent` with the district's concept)
  - `Sources`
  - the `ReviewBanner` whenever the content shown isn't reviewed
- **No JavaScript:** show a polite `<noscript>` message, like the story player does.
- **Phones held upright:** letterbox the 16:9 canvas and put the touch controls (◀ ▶ jump) below it. Suggest rotating to landscape, but don't require it.
- **Two layers** **(designer's call)**:
  - **The canvas** draws the action: running, gates and their short labels, and the boss fight.
  - **HTML overlays** draw everything that's mostly *reading*: caught/red-flag screens, level-clear rule and grown-up card, the stash reveal, Scam Files, the district map and settings. Overlays sit on top of the canvas on large screens and fill the screen on small or upright phones. They use `textContent` only and respect the site's text-size and contrast settings.
  - On a phone held upright, the reading screens are fully readable. The action part asks the player to rotate but still works letterboxed.
- Settings hold: sound on or off, reduced motion, and a reset-progress option with a confirm step.
- **Nav and home tile** appear only when at least one district is published. In production, nothing shows until a district is reviewed.

## 8. Content model **(designer's call)**

All teaching text lives in content files so experts can review it without reading code. Level geometry stays in code.

**Each level** has its own `habit` and `rule`, and may set its own `concept` (falling back to the district's). The district has an umbrella `habit`.

**New collection `gameDistricts`**: one JSON file per district in `src/content/gameDistricts/`, e.g. `link-alley.json`. Each file includes the standard `reviewFields`, so the review gate, concept tags, sources and reviewer fields all work unchanged. The district is the unit of review: one file, one reviewer sign-off.

Shape (illustrative, the builder finalises field names):

```jsonc
{
  "title": "Link Alley",
  "concept": "malicious-links-qr",
  "relatedConcepts": ["phishing"],
  "ageLevels": ["kids"],
  "summary": "Learn to read web addresses before you tap.",
  "reviewStatus": "draft", "reviewer": "", "reviewDate": null, "sources": [],

  "formatVersion": 1,
  "order": 1,
  "habit": "Check before you tap.",
  "levels": [
    {
      "id": "level-1",
      "title": "The Library Run",
      "habit": "Read the address",
      "concept": "malicious-links-qr",
      "goal": "Get Max to the real Library",
      "layout": "alley-1",            // name of a level layout defined in code
      "rule": "Read the address. Every letter counts.",
      "grownUpChallenge": {
        "prompt": "Can your grown-up spot the fake?",
        "options": ["school-portal.org", "schoo1-portal.org"],
        "answer": 1,
        "explain": "The fake uses the number 1 instead of the letter l."
      },
      "gates": [
        {
          "id": "gate-1",
          "type": "choose-portal",     // or "trust-or-report"
          "rounds": [
            {
              "prompt": "Which portal is the REAL library?",
              "options": [
                { "label": "library.org", "safe": true },
                { "label": "libary.org", "safe": false,
                  "redFlag": "libary.org is missing an 'r'. Fakes copy real names and change one letter." },
                { "label": "FREE-GAMES-library.win", "safe": false,
                  "redFlag": "Real sites don't shout FREE. Strange endings like .win are a warning sign." }
              ]
            }
          ]
        }
      ]
    }
  ],
  "boss": {
    "name": "PHISH.BOT",
    "intro": "PHISH.BOT wants Max to tap a fake link!",
    "waves": [
      { "messages": [
        { "text": "Your account is LOCKED! Tap here now", "fake": true,
          "redFlag": "Panic words like LOCKED and NOW are a trick to rush you." },
        { "text": "Mum: Home by 6 tonight?", "fake": false }
      ] }
    ]
  },
  "scamFileRewards": ["password-grabber", "fake-login-page", "sneaky-peeker"]   // ids from the scamFiles collection
}
```

**Separate collection `scamFiles`** **(designer's call)**: one file per card in `src/content/scamFiles/`, with its own `reviewFields`, so password tricks are reviewed under the `passwords` concept, not inside Link Alley's file. Each card has `title`, `example`, `howToSpot`, `whatToDo` and `district` (the district it previews, e.g. `password-tower`). A district's `scamFileRewards` lists the card ids its boss reveals. Only cards that pass `getPublished` are revealed. Locked silhouettes are counted from all published cards. The later printable handout reuses this collection.

```jsonc
// src/content/scamFiles/password-grabber.json
{ "title": "The Password Grabber", "concept": "passwords", "ageLevels": ["kids"],
  "summary": "...", "reviewStatus": "draft", "sources": [],
  "example": "Your game account will be deleted! Enter your password to keep it.",
  "howToSpot": "Real games never ask for your password in a message.",
  "whatToDo": "Close it and tell a grown-up.",
  "district": "password-tower" }
```

**Validator additions** (`scripts/validate-content.mjs` + the Zod schema):

- Every round has exactly one `safe: true` option for `choose-portal`, and the item's `safe` flag set for `trust-or-report`.
- Every unsafe option and every `fake: true` boss message has a `redFlag`.
- Every level has a `rule` and a `grownUpChallenge` with a valid `answer` index.
- Every level's `layout` names a layout that exists in the game code. The builder decides how the validator learns the list.
- Every boss wave has at least one fake and one real message, and the boss has enough messages for the 3-wave fight.
- Every id in `scamFileRewards` names an existing `scamFiles` file.
- The existing "no HTML or scripts" string check covers every string in the file, which it already does.
- `npm run validate` stays the single check that runs before every build.

**Draft visibility:** the game page offers only districts that pass `getPublished`. In production, an unreviewed district simply doesn't appear. In dev and preview it appears with a draft banner. If no district is reviewed, `/games/neon-city/` doesn't build, and `/games/` shows the site's existing `EmptyState`.

**Contributor docs:** add a `templates/game-district.json` and a short section in `CONTRIBUTING.md`, matching how stories are documented.

## 9. Saved progress **(designer's call)**

Progress is stored under the existing `sc-progress` key, in a `games.neonCity` object. It never holds personal data.

```jsonc
{ "games": { "neonCity": {
    "version": 1,
    "levels": { "link-alley/level-1": { "cleared": true, "bestStars": 3 } },
    "bosses": { "link-alley": { "defeated": true } },
    "scamFiles": ["password-grabber"],
    "settings": { "muted": false, "reducedMotion": false }
} } }
```

- Read and write through try/catch, like `storage.ts`. If storage is blocked, the game still works for that session.
- Unknown or corrupt data falls back to a fresh start and never crashes the game.
- Reduced motion also defaults from the system `prefers-reduced-motion` setting.

## 10. Accessibility **(designer's call)**

- The whole game is playable with keyboard only, touch only or mouse only.
- Colour is never the only signal. Safe/unsafe and real/fake are always shown with text or icons too.
- Reading text has strong contrast against the dark background (WCAG AA for text), even where neon labels are decorative.
- Reduced motion turns off screen shake and flashing glitches and slows the boss fight.
- Flashing effects stay below 3 flashes per second.
- The page outside the canvas follows the site's existing accessibility standards: headings, focus and the `aria-live` pattern from `StoryPlayer`.

## 11. Testing expectations

- `npm run validate` covers the new content rules, including failing cases.
- Game logic that doesn't need a browser should be written as plain functions and unit-tested: scoring, stars, progress read/write and migration, round selection on retry, and boss damage rules. The site has no test runner yet. The builder may add a lightweight one, Vitest preferred since Astro uses Vite.
- Manual or automated playthrough of Link Alley on a phone-sized screen and a desktop screen. Check that the CSP in `vercel.json` raises no errors in the browser console.
- The production build excludes a draft district and includes it once it's marked `reviewed`. The Games nav link and the home tile hide when no district is published.

## 12. Left to the builder

- Code structure under `src/` (e.g. `src/game/` for Phaser scenes), scene breakdown, and how Astro mounts the game.
- Exact physics values, level layouts, platform shapes, how hard each level is, and boss timing within the rules above.
- Visual details within the Neon City palette and mockups: exact glow effects, particles and animations.
- Exact JSON field names, as long as the rules in section 8 hold.
- How the validator learns the list of layout names.
- Which sound effects to use, as long as they're self-made or CC0 and credited.
- Placeholder Link Alley content for development, marked `draft`. The final wording comes from content authors and expert review, not from the builder.

## 13. Open items for later releases (not for this build)

- Districts 2 to 6 and the final boss, which ties all the agents together.
- Printable Scam Files handout for parents.
- More gate types, e.g. "tap the suspicious part of this message."
- Read-aloud for younger kids.
