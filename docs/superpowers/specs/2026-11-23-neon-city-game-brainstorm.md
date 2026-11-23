# SafeClick game: Max's Safe Trip (Neon City), brainstorm notes

**Status:** Brainstorming, not yet an approved design. The look, structure and boss fights are decided; the build approach is still open. The next step after that is a full design doc in this folder, then an implementation plan.

**Date:** 2026-11-23
**Mockups:** [`../mockups/game-look-dark.html`](../mockups/game-look-dark.html) (chosen look), [`../mockups/game-look-light.html`](../mockups/game-look-light.html) (earlier, rejected looks)

Items marked *(proposal)* are suggestions from the brainstorm that haven't been explicitly confirmed and can still be changed.

## Why

- SafeClick's first real game, aimed at the **Kids** level of the site.
- Kids play because it's **fun and addictive**, not because it's a lesson. Learning a security habit is the by-product.
- Each level leaves the child with **one specific security habit**.
- Success means kids repeat the habit to their **parents and friends** on their own.

## Audience

- Ages **8 to 12**, meaning kids who can read short signs. Every gate pairs words with an icon so a younger sibling can play next to a parent. *(proposal, since the age question was left open)*
- Works on phone, tablet and computer, with on-screen touch buttons plus arrow keys. *(proposal)*

## Look: Neon City (decided)

- A synthwave night city: dark sky, glowing grid floor, and pink, cyan and gold neon.
- **Max** is a young cyber-guardian in a hoodie with a glowing visor. He defends himself online; he isn't a hacker breaking into things.
- The villains are glitchy **scam bots**, such as PHISH.BOT. Getting caught means being trapped in a data cage, never police or an arrest. Kids should feel safe telling a grown-up when they've been tricked, not feel like they're the ones in trouble.
- Code-style font and punchy HUD text, e.g. `GATE_02 // FIND THE REAL LIBRARY`.
- Rejected looks: storybook cartoon, retro pixel art, paper cut-out, terminal grid, midnight aurora.

## Structure (decided)

**District (world) → Levels → Gates → Boss**

- **Level:** one 2D scene where Max runs and jumps from point A to point B, with several gates along the way. A level takes 1 to 3 minutes.
- **Gate:** a short security challenge that *is* the habit. For example, the player picks the real portal from `library.org`, `libary.org` and `FREE-GAMES-library.win`.
- **Caught:** the scam bot traps Max. One line shows the red flag the player missed, and the retry starts **from that gate**, not from the beginning of the level.
- **Level clear:** stars, then a one-line rule to remember ("Read the address. Every letter counts."), then a **"Challenge a grown-up"** card, e.g. spot the fake between `school-portal.org` and `schoo1-portal.org`.

## Boss fights (decided)

- There's **a boss at the end of every district, plus one final boss** for the whole game.
- The fight *is* the habit. The boss fires scam moves at Max: fake messages, fake links and "URGENT!!" pop-ups. Max shields the fakes and lets the real ones through, and every correct block bounces back at the boss.
- There's no real violence: Max zaps, blocks and deflects, and a defeated agent glitches out and crashes.
- After winning, Max **opens the agent's stash**, which reveals the traps waiting in the **next district** (phishing, social engineering and so on).
- Each trap becomes a card in a **Scam Files** collection. It gives kids a reason to come back, and the cards could also become a printable handout for parents.

## Districts

Each district is built on one of the site's existing concept tags, so every level can link to matching cards and stories.

| District | Habit | Site concept(s) |
|---|---|---|
| Link Alley | Read the address, every letter counts | malicious-links-qr, phishing |
| Password Tower | Long, secret, different for every app | passwords |
| Code Vault | Never share a code someone sends you | two-factor, account-takeover |
| Free Wi-Fi Plaza | Free Wi-Fi isn't private Wi-Fi | public-wifi |
| Overshare Square | Think before you post where you are | privacy-oversharing |
| Fake Friend Arcade | "Hurry!" and "Don't tell anyone" are red flags | urgency-fear, impersonation-scams, smishing-vishing |

## First release *(proposal)*

- **Link Alley only:** 3 gate levels, the PHISH.BOT boss and the first Scam Files cards.
- Put it in front of a few real kids and see whether they come back before building more districts.

## Healthy "addictive" *(proposal)*

- **Yes:** unlocking levels, stars, collecting Scam Files, beating your own best.
- **No:** guilt-trip streaks, timers that pressure kids to come back, loot-box mechanics.

## Constraints from SafeClick

- **Privacy:** no accounts, cookies, analytics or trackers. Progress lives only in the browser (localStorage, see `STORAGE_KEYS` in `src/site.config.ts`). No names and no online leaderboards. The game library, if we use one, is bundled with the site, never loaded from a third-party CDN.
- **Expert review:** nothing goes live unreviewed. Game text (gate questions, addresses, red-flag lines, rules and Scam Files) lives in **content files**, like `src/content/stories/`, so it goes through the same review gate in `src/content.config.ts` and the same checks in `scripts/validate-content.mjs`.
- **Stack:** the site is built with Astro. The existing story games use a plain-JS engine in `src/scripts/story-engine.js`.

## Open decision: how to build it

| Option | Pros | Cons |
|---|---|---|
| **1. Phaser game library** (recommended) | Physics, collisions, particles, glow, sound and touch controls are built in, which suits the boss fight best. It's bundled into the site. | About 1 MB of JS, loaded on the game page only |
| 2. Plain JavaScript from scratch | Tiny, no new dependencies, full control | Physics and effects have to be built by hand, so the boss fight is slower to build and less polished |
| 3. Kaplay (a lighter library) | Smaller and simpler | Smaller community and weaker effects for the neon look |

## Next steps

- [ ] Pick the build approach
- [ ] Write the full design doc
- [ ] Approve the design doc
- [ ] Write the implementation plan
- [ ] Build Link Alley: 3 levels, the PHISH.BOT boss and Scam Files
- [ ] Get expert review of all game text
- [ ] Test with a few kids
