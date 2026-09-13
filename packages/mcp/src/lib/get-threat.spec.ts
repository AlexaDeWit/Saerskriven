import { getThreat, renderThreatRecord } from './get-threat.js';
import {
  answerOf,
  assumptionScopesTree,
  ecluseWorkspace,
  everyRecordTree,
  refusalOf,
} from './read-tools.fixtures.js';

const ecluse = ecluseWorkspace();

describe('what saer_get_threat reads', () => {
  it('reads one threat by its number', () => {
    const read = answerOf(getThreat(ecluse, { ref: '1' }));
    expect(read.threat.number).toBe(1);
  });

  it('reads the same threat by its id', () => {
    const byNumber = answerOf(getThreat(ecluse, { ref: '1' }));
    expect(answerOf(getThreat(ecluse, { ref: byNumber.threat.id }))).toEqual(
      byNumber,
    );
  });

  it('names the elements the threat attaches to', () => {
    const read = answerOf(getThreat(ecluse, { ref: '1' }));
    expect(read.elements.map((element) => element.id)).toEqual(
      read.threat.elements,
    );
  });

  it('carries the mitigations and assumptions the model links to it', () => {
    const read = answerOf(getThreat(ecluse, { ref: '1' }));
    expect({
      mitigations: read.mitigations.map(({ threats }) => threats),
      assumptions: read.assumptions,
    }).toEqual({ mitigations: [[read.threat.id]], assumptions: [] });
  });

  it('refuses a ref naming no threat, with the count the model holds', () => {
    const refused = refusalOf(getThreat(ecluse, { ref: '9999' }));
    expect(refused[0]).toContain('holds no threat "9999"');
    expect(refused[1]).toContain('It holds 29 threats.');
  });
});

describe('a threat the model links work to', () => {
  const rich = everyRecordTree();

  const read = answerOf(getThreat(rich, { ref: '1' }));

  it('carries the mitigations addressing it', () => {
    expect(read.mitigations.map((one) => one.id)).toEqual(['mitigation-tls']);
  });

  it('carries the assumptions its analysis rests on', () => {
    expect(read.assumptions.map((one) => one.id)).toEqual([
      'assumption-managed-db',
    ]);
  });

  it('names both of them in the text of the result', () => {
    const rendered = renderThreatRecord(read).join('\n');
    expect(rendered).toContain('mitigation-tls (proposed):');
    expect(rendered).toContain('assumption-managed-db (valid):');
  });
});

describe('a threat whose assumption also applies to the model', () => {
  const read = answerOf(
    getThreat(assumptionScopesTree(), { ref: 'threat-tamper-order' }),
  );

  it('carries its flags and the assumptions linked to it, and no assumption that links it not', () => {
    expect({
      flags: read.flags,
      assumptions: read.assumptions.map(({ id }) => id),
    }).toEqual({
      flags: [],
      assumptions: ['assumption-managed-db', 'assumption-reviewed'],
    });
  });

  it('says in its text which of them also applies to the model', () => {
    const rendered = renderThreatRecord(read);
    expect(rendered).toContain('flags: none');
    expect(
      rendered.filter((line) => line.includes('also applies to the model')),
    ).toEqual([expect.stringContaining('assumption-reviewed')]);
  });
});
