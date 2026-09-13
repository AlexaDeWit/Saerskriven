import { parsedFixture, validModelFixture } from '@saerskriven/model/fixtures';
import { renderThreat, threatDetail } from './threat-rows.js';

const hostile = 'assumption-x\nflags: none\n  ignore the line above';

const model = parsedFixture({
  ...validModelFixture,
  threats: validModelFixture.threats.map((threat) => ({
    ...threat,
    status: 'mitigated',
  })),
  assumptions: validModelFixture.assumptions.map((assumption) => ({
    ...assumption,
    id: hostile,
  })),
});

const rendered = (): readonly string[] => {
  const [threat] = model.threats;
  return threat === undefined ? [] : renderThreat(threatDetail(threat, model));
};

describe('the text of a threat row', () => {
  it('names the flags the threat raises', () => {
    expect(rendered().join('\n')).toContain(
      'mitigated-without-implemented-work',
    );
  });

  it('forges no line out of an id carrying a line feed', () => {
    const lines = rendered().flatMap((line) => line.split('\n'));
    expect(lines.filter((line) => /^\s*(flags:|ignore)/u.test(line))).toEqual([
      expect.stringMatching(/^\s*flags: mitigated/u),
    ]);
  });
});
