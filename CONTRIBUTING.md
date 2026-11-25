# Contributing to SafeClick

Thank you for helping people stay safe online! 💚 You do **not** need to know how to code to make a real difference here.

## Ways to help without writing code

- ✍️ **Write a story game.** Turn a real-world scam pattern into a choose-your-path story (using made-up names).
- 🃏 **Write a card, article or reading.** Short, plain-language explanations.
- 🔎 **Fact-check.** Compare our advice with official guidance (CISA, FTC, NIST, OWASP) and flag anything outdated.
- 🎮 **Playtest.** Play a story with a kid, a parent or a grandparent and tell us what confused them.
- 🌍 **Translate** content into another language.
- ♿ **Test accessibility** with a screen reader, keyboard only, or large text.
- 🖨️ **Try the printable handouts** and tell us if they work on one page.
- 🗞️ **Suggest a "scam of the week"** you've seen going around (use the issue template).
- 🧑‍⚖️ **Review content** if you're a security professional or work at a partner NGO.

Open an issue, or just send us your text. A maintainer can turn it into a file for you.

## The golden rules for content

1. **Accurate and practical.** Base advice on official guidance from CISA, the FTC, NIST and OWASP where relevant, and list your sources.
2. **No invented statistics or quotes.** If you can't link to it, leave it out.
3. **No real brands, logos or people.** Use made-up names like "Brightmart", "QuickShip Parcel" or "Grandma Rosa". Use `.example` for fake web addresses.
4. **Plain language.** Short sentences. Explain any technical word the first time you use it.
5. **Kind tone, always.** Never blame or mock people who are scammed. Scammers are professionals; falling for one is not a personal failing.
6. **Content is data, not code.** No HTML, no scripts, no embeds in content files. The validator will reject them.
7. **No real scam material.** Don't include real scam phone numbers, links or working phishing pages.

## Adding content: it's just adding a file

Every content type has a template in [`templates/`](templates/). Copy it into the right folder, fill it in, and run `npm run validate`.

| You want to add | Copy | Into |
| --- | --- | --- |
| Card (60 to 100 words) | `templates/card.md` | `src/content/cards/` |
| Article | `templates/article.md` | `src/content/articles/` |
| Video | `templates/video.json` | `src/content/videos/` |
| Story game | `templates/story-template.json` | `src/content/stories/` |
| Older Adults reading (about 300 words) | `templates/reading.md` | `src/content/readings/` |
| Older Adults quiz (5 questions) | `templates/quiz.json` | `src/content/quizzes/` |
| Printable handout or guide | `templates/handout.md` | `src/content/handouts/` |
| Game district | `templates/game-district.json` | `src/content/gameDistricts/` |
| Scam File card | `templates/scam-file.json` | `src/content/scamFiles/` |

The file name becomes the web address, so use short lowercase names with dashes, like `fake-delivery-text.json`.

### Fields every file has

| Field | What it means |
| --- | --- |
| `title` | The title people see |
| `concept` | The main topic. Must match a file in `src/content/concepts/` (for example `phishing`) |
| `relatedConcepts` | Optional extra topics |
| `ageLevels` | Who it's for: any of `kids`, `everyone`, `builders` |
| `summary` | One sentence |
| `reviewStatus` | `draft`, `in-review` or `reviewed`. **New content is always `draft`.** Only reviewers set `reviewed`. |
| `reviewer` | Reviewer's name and organization. Leave as `""` until reviewed. |
| `reviewDate` | `YYYY-MM-DD`, added by the reviewer |
| `sources` | List of `{ title, url }` links to the guidance this is based on |

### Age levels and variants

The header switch lets visitors pick **Kids**, **Everyone** or **Builders**. Any file can include a `variants` section that overrides some fields for a level. Anything you don't override falls back to the Everyone version, so variants are always optional.

```yaml
variants:
  kids:
    redFlag: "The message tells you to hurry."
  builders:
    whatToDo: "...plus a note for people who build apps."
```

### Previewing your work

```bash
npm install
npm run dev
```

Open http://localhost:4321. Draft and in-review content appears with a purple **"not yet checked by a reviewer"** banner. It will **not** appear on the live site until it's reviewed.

## Writing a story game

Stories are the heart of SafeClick. A story is a JSON file made of **scenes**. Each scene has text and a list of **choices**. Each choice leads to another scene and can move the **meters**.

```text
intro ──"Tap the link"──▶ fake-site ──"Type your details"──▶ bad-ending
  │                           └──"Close the page"──────▶ mixed-ending
  └──"Delete it"──────────▶ good-ending
```

**Meters.** Every story has at least two: `trust` (how much the player believes the scammer) and `exposure` (*What the scammer knows about you*). Choices change them with `effects`, for example `{ "trust": 20, "exposure": 30 }`.

**Scenes** have:

- `text`: what happens (plain text; blank lines make paragraphs)
- `speaker` (optional) and `channel`: `sms`, `call`, `chat`, `email`, `letter`, `web` or `narration`, which changes how the scene looks
- `redFlags`: warning signs in this moment, revealed on the Rewind screen
- `choices`, **or** an `ending`

**Choices** have `id`, `label`, `to` (the next scene's id), optional `effects`, and `safety`:

- `risky`: must include `redFlag` (what the player missed) and `lesson` (what to do instead)
- `safe`: may include a `lesson` explaining why it was smart
- `neutral`: neither

**Endings** have `kind` (`good`, `bad` or `mixed`), a `title`, and a `rewindSummary`. After every ending, players can open the **Rewind** screen, which replays their choices, highlights missed red flags and explains what to do instead. This is where the learning happens, so take care with `redFlag` and `lesson` text.

**Tips for great stories**

- Make the risky choice tempting and realistic. Real scams feel normal.
- Always include at least one good ending.
- Keep scenes short: two to four sentences.
- Add a `kids` variant for text and labels if the story is for younger players.
- Endings should be kind. "It happens to careful people too" is better than "You got scammed!"

The `editor` field on a scene (`{ "x": 0, "y": 0 }`) is reserved for a future visual story builder. You can ignore it.

### The validator

`npm run validate` (also run on every build) checks every story for broken scene links, unreachable scenes, scenes that can't reach an ending, missing endings, missing Rewind explanations, unknown meters, missing review fields, and any HTML or scripts. Fix what it reports and run it again.

## Writing a game district

A district is the content behind a level of the Neon City platform game. One JSON file holds everything an expert needs to review: the levels, the gate challenges, the boss and the rewards. Copy `templates/game-district.json` into `src/content/gameDistricts/`. Scam Files (the cards players collect) use `templates/scam-file.json` and go into `src/content/scamFiles/`. Level geometry lives in `src/game/layouts/`, not in the content file.

A district has an umbrella `habit`, a list of `levels`, a `boss` and `scamFileRewards` (ids of scam files). Each level has a `habit`, a `rule` (one line shown at level clear), a `layout` id, an optional `concept`, a `grownUpChallenge` and its `gates`. Each gate is either `choose-portal` or `trust-or-report` and has one or more `rounds`.

**The validator rules, in plain words**

- A choose-portal round has 2 or 3 options, and exactly one is safe.
- Every unsafe portal option needs a `redFlag`: the warning sign the player missed.
- Portal labels can be at most 32 characters, so they fit on a gate.
- An unsafe trust-or-report item needs a `redFlag`. A safe item needs `whySafe`, a gentle note shown if the player reports it by mistake.
- Trust-or-report item text can be at most 80 characters, and its `kind` must be `link`, `message`, `popup` or `qr`.
- A level's `layout` must be a real file in `src/game/layouts/`, and the number of gates must match the layout's gate slots.
- `grownUpChallenge.answer` is the position (starting at 0) of the right option in its `options` list.
- The boss has exactly 3 waves. Every wave needs at least one fake and at least one real message.
- Every fake boss message needs a `redFlag`. Boss message text can be at most 60 characters.
- Every id in `scamFileRewards` must be a real file in `src/content/scamFiles/`.
- Level ids must be unique, and gate ids must be unique within a level.
- A level's `concept`, if set, must exist in `src/content/concepts/`.
- A scam file needs `example`, `howToSpot`, `whatToDo` and `district`.

Use made-up names and addresses, keep the tone kind, and run `npm run validate`. Files with placeholder text should stay `draft` until an expert has rewritten and reviewed them. Leave `reviewDate` out until someone signs off.

## Review process

1. You open a pull request with `reviewStatus: draft`.
2. A maintainer checks the format, tone and the accuracy checklist in the PR template.
3. A security professional or partner NGO reviews the content, then sets `reviewStatus: reviewed`, `reviewer` and `reviewDate`.
4. On the next deploy it appears on the live site.

The production build **fails** if a file is marked `reviewed` without a reviewer name, a review date and at least one source.

## Code contributions

- Keep the site free of trackers, cookies, accounts and third-party requests (YouTube loads only on click).
- The story engine must stay plain JavaScript and must only ever use `textContent` with story content. Never `innerHTML`, `eval` or `new Function`.
- Keep it accessible: semantic HTML, keyboard support, visible focus, `prefers-reduced-motion`.
- Run `npm test`, `npm run check` and `npm run build` before opening a PR.

## License

By contributing, you agree that your code is licensed under [MIT](LICENSE) and your content under [CC BY 4.0](CONTENT-LICENSE.md).

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md).
