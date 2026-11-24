import { describe, it, expect } from 'vitest';
// @ts-expect-error plain .mjs module without types
import { checkGameDistrict, checkScamFile } from '../scripts/lib/game-checks.mjs';

const ctx = {
  layoutGateCounts: { 'alley-1': 3 } as Record<string, number>,
  scamFileIds: new Set(['password-grabber']),
  concepts: new Set(['malicious-links-qr', 'phishing', 'passwords']),
};

const portalRound = () => ({
  prompt: 'Max needs the real Library.',
  options: [
    { label: 'library.org', safe: true },
    { label: 'libary.org', safe: false, redFlag: 'It is missing an r.' },
    { label: 'FREE-GAMES-library.win', safe: false, redFlag: 'The real name is buried.' },
  ],
});

const gate = (id: string) => ({ id, type: 'choose-portal', rounds: [portalRound(), portalRound()] });

const wave = () => ({
  messages: [
    { text: 'Your account is LOCKED! Tap here', fake: true, redFlag: 'Urgent threat.' },
    { text: 'Mum: Home by 6 tonight?', fake: false },
    { text: 'You won a free phone!', fake: true, redFlag: 'Surprise prize.' },
  ],
});

function validDistrict(): any {
  return {
    order: 1,
    habit: 'Check before you tap.',
    levels: [
      {
        id: 'level-1',
        title: 'Read the address',
        goal: 'Reach the exit',
        habit: 'Read the address.',
        rule: 'Every letter counts.',
        layout: 'alley-1',
        grownUpChallenge: { prompt: 'Which is real?', options: ['a', 'b'], answer: 0, explain: 'Because.' },
        gates: [gate('gate-1'), gate('gate-2'), gate('gate-3')],
      },
    ],
    boss: { name: 'PHISH.BOT', intro: 'Hi.', waves: [wave(), wave(), wave()] },
    scamFileRewards: ['password-grabber'],
  };
}

const run = (mutate: (d: any) => void) => {
  const d = validDistrict();
  mutate(d);
  return checkGameDistrict(d, ctx);
};
const trustGate = (round: object) => ({ id: 'gate-1', type: 'trust-or-report', rounds: [round] });
const trustRound = (over: object = {}) => ({
  prompt: 'What do you do?',
  item: { kind: 'link', text: 'http://prize.example/win' },
  safe: false,
  redFlag: 'Surprise prize.',
  ...over,
});

describe('checkGameDistrict', () => {
  it('accepts a valid district', () => expect(checkGameDistrict(validDistrict(), ctx)).toEqual([]));

  it('requires exactly one safe portal', () => {
    const errs = run((d) => { d.levels[0].gates[0].rounds[0].options[1].safe = true; });
    expect(errs).toContainEqual(expect.stringMatching(/exactly one safe/));
  });

  it('requires redFlag on unsafe portal options', () => {
    const errs = run((d) => { delete d.levels[0].gates[0].rounds[0].options[1].redFlag; });
    expect(errs).toContainEqual(expect.stringMatching(/redFlag/));
  });

  it('caps portal labels at 32 characters', () => {
    const errs = run((d) => { d.levels[0].gates[0].rounds[0].options[0].label = 'x'.repeat(33); });
    expect(errs).toContainEqual(expect.stringMatching(/32 characters/));
  });

  it('requires 2 or 3 portal options', () => {
    const errs = run((d) => { d.levels[0].gates[0].rounds[0].options.pop(); d.levels[0].gates[0].rounds[0].options.pop(); });
    expect(errs).toContainEqual(expect.stringMatching(/2 or 3 options/));
  });

  it('requires redFlag for unsafe trust-or-report items and whySafe for safe ones', () => {
    const noFlag = run((d) => {
      const r = trustRound(); delete (r as any).redFlag;
      d.levels[0].gates[0] = trustGate(r);
    });
    expect(noFlag).toContainEqual(expect.stringMatching(/redFlag/));
    const noWhy = run((d) => { d.levels[0].gates[0] = trustGate(trustRound({ safe: true, redFlag: undefined })); });
    expect(noWhy).toContainEqual(expect.stringMatching(/whySafe/));
  });

  it('caps trust-or-report item text at 80 characters', () => {
    const errs = run((d) => {
      d.levels[0].gates[0] = trustGate(trustRound({ item: { kind: 'link', text: 'x'.repeat(81) } }));
    });
    expect(errs).toContainEqual(expect.stringMatching(/80 characters/));
  });

  it('rejects an unknown item kind', () => {
    const errs = run((d) => {
      d.levels[0].gates[0] = trustGate(trustRound({ item: { kind: 'carrier-pigeon', text: 'hi' } }));
    });
    expect(errs).toContainEqual(expect.stringMatching(/kind/));
  });

  it('rejects an unknown layout', () => {
    const errs = run((d) => { d.levels[0].layout = 'nope'; });
    expect(errs).toContainEqual(expect.stringMatching(/layout "nope"/));
  });

  it('requires gate count to match the layout', () => {
    const errs = run((d) => { d.levels[0].gates.pop(); });
    expect(errs).toContainEqual(expect.stringMatching(/layout "alley-1" has 3 gate slots but the level has 2 gates/));
  });

  it('requires grownUpChallenge.answer to be a valid index', () => {
    const errs = run((d) => { d.levels[0].grownUpChallenge.answer = 5; });
    expect(errs).toContainEqual(expect.stringMatching(/answer/));
  });

  it('requires exactly 3 boss waves', () => {
    const errs = run((d) => { d.boss.waves.pop(); });
    expect(errs).toContainEqual(expect.stringMatching(/3 waves/));
  });

  it('requires a fake and a real message in every wave', () => {
    const errs = run((d) => { d.boss.waves[0].messages.forEach((m: any) => { m.fake = true; m.redFlag = 'x'; }); });
    expect(errs).toContainEqual(expect.stringMatching(/wave 1 needs at least one real/));
  });

  it('requires redFlag on fake boss messages', () => {
    const errs = run((d) => { delete d.boss.waves[1].messages[0].redFlag; });
    expect(errs).toContainEqual(expect.stringMatching(/redFlag/));
  });

  it('caps boss message text at 60 characters', () => {
    const errs = run((d) => { d.boss.waves[2].messages[1].text = 'x'.repeat(61); });
    expect(errs).toContainEqual(expect.stringMatching(/60 characters/));
  });

  it('rejects scamFileRewards that do not exist', () => {
    const errs = run((d) => { d.scamFileRewards = ['nope']; });
    expect(errs).toContainEqual(expect.stringMatching(/scam file "nope" does not exist/));
  });

  it('rejects duplicate level ids and duplicate gate ids within a level', () => {
    const dupLevel = run((d) => { d.levels.push({ ...d.levels[0] }); });
    expect(dupLevel).toContainEqual(expect.stringMatching(/duplicate/));
    const dupGate = run((d) => { d.levels[0].gates[1].id = 'gate-1'; });
    expect(dupGate).toContainEqual(expect.stringMatching(/duplicate/));
  });

  it('rejects an unknown level concept', () => {
    const errs = run((d) => { d.levels[0].concept = 'nope'; });
    expect(errs).toContainEqual(expect.stringMatching(/concept/));
  });
});

describe('checkScamFile', () => {
  it('requires example, howToSpot, whatToDo and district', () => expect(checkScamFile({})).toHaveLength(4));
  it('accepts a complete scam file', () =>
    expect(checkScamFile({ example: 'a', howToSpot: 'b', whatToDo: 'c', district: 'password-tower' })).toEqual([]));
});
