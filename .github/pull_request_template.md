## What does this PR add or change?

<!-- e.g. "New story game about a fake job offer" or "Fixes a typo in the passwords card" -->

## Type

- [ ] New content (card, article, video, story, reading, quiz, handout)
- [ ] Content fix
- [ ] Code or design
- [ ] Docs

## Accuracy checklist (for content)

- [ ] **Sources cited.** Every piece of advice is backed by a link in `sources` (CISA, FTC, NIST, OWASP or similar official guidance).
- [ ] **No real brands.** Only made-up company, product and person names. No logos. Fake web addresses use `.example`.
- [ ] **No invented statistics or quotes.** Every number or quote links to its source, or it's removed.
- [ ] **Plain language.** Short sentences. Any technical term is explained the first time it's used.
- [ ] **Kind tone.** Nothing blames, shames or mocks people who are scammed.
- [ ] **Practical.** Every red flag comes with something the reader can actually do.
- [ ] **New content is `reviewStatus: draft`.** Only reviewers set `reviewed`.
- [ ] **No real scam material.** No real scam phone numbers, links or working phishing content.

## For story games

- [ ] At least one good ending
- [ ] Every risky choice has a `redFlag` and a `lesson`
- [ ] Every ending has a kind `rewindSummary`
- [ ] Playtested at least once

## Checks

- [ ] `npm run validate` passes
- [ ] `npm run build` passes
- [ ] Previewed in `npm run dev` (and with the Kids / Everyone / Builders switch if there are variants)
