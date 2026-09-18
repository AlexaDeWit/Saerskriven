import {
  assumptionIdSchema,
  diagramIdSchema,
  elementIdSchema,
  mitigationIdSchema,
  threatIdSchema,
} from '@saerskriven/model';
import type { DivergenceDetail } from './divergence-detail.js';
import {
  escapedForTerminal,
  hasDiverged,
  renderDivergences,
  type Divergence,
  type DivergenceReason,
  type DivergenceSubject,
} from './divergence.js';

const escapeChar = String.fromCharCode(27);

const bellChar = String.fromCharCode(7);

const entry = (
  subject: DivergenceSubject,
  detail: DivergenceDetail,
  reason: DivergenceReason,
): Divergence => ({ subject, detail, reason });

const undeclared = (path: string): DivergenceDetail => ({
  code: 'key-undeclared',
  parameters: { path },
});

const threatSubject: DivergenceSubject = {
  kind: 'threat',
  id: threatIdSchema.parse('threat-4'),
};

const splitThreat = entry(
  threatSubject,
  { code: 'threat-split-across-elements', parameters: { count: 3 } },
  'split',
);

describe('divergences', () => {
  it('are empty where the file and the model correspond', () => {
    expect(hasDiverged([])).toBe(false);
  });

  it('count as diverged once one is recorded', () => {
    expect(hasDiverged([splitThreat])).toBe(true);
  });
});

describe('renderDivergences', () => {
  it('says so where nothing diverged', () => {
    expect(renderDivergences([])).toBe('No divergence recorded.');
  });

  it('renders one line per entry, in the recorded order', () => {
    const divergences = [
      splitThreat,
      entry(
        { kind: 'element', id: elementIdSchema.parse('element-customer') },
        undeclared('cells.0.ports'),
        'discarded-by-edit',
      ),
    ];
    expect(renderDivergences(divergences)).toBe(
      [
        'threat "threat-4": the one record, written once under each of the 3 elements it names (split by the format)',
        'element "element-customer": the key cells.0.ports (removed by an edit)',
      ].join('\n'),
    );
  });

  it('names the model as a whole where no record owns the divergence', () => {
    expect(
      renderDivergences([
        entry({ kind: 'model' }, undeclared('threatTop'), 'unrepresentable'),
      ]),
    ).toBe('model: the key threatTop (no place in the format)');
  });

  it('names every other entity kind by its kind and id', () => {
    const subjects: DivergenceSubject[] = [
      { kind: 'diagram', id: diagramIdSchema.parse('diagram-main') },
      { kind: 'element', id: elementIdSchema.parse('element-customer') },
      { kind: 'threat', id: threatIdSchema.parse('threat-4') },
      { kind: 'mitigation', id: mitigationIdSchema.parse('mitigation-1') },
      { kind: 'assumption', id: assumptionIdSchema.parse('assumption-1') },
    ];
    const divergences = subjects.map((subject) =>
      entry(subject, undeclared('notes'), 'unrepresentable'),
    );
    expect(renderDivergences(divergences).split('\n')).toEqual([
      'diagram "diagram-main": the key notes (no place in the format)',
      'element "element-customer": the key notes (no place in the format)',
      'threat "threat-4": the key notes (no place in the format)',
      'mitigation "mitigation-1": the key notes (no place in the format)',
      'assumption "assumption-1": the key notes (no place in the format)',
    ]);
  });

  it('words every reason', () => {
    const reasons: DivergenceReason[] = [
      'unrepresentable',
      'undeclared',
      'narrowed',
      'split',
      'overridden',
      'discarded-by-edit',
    ];
    const divergences = reasons.map((reason) =>
      entry({ kind: 'model' }, undeclared('notes'), reason),
    );
    expect(renderDivergences(divergences).split('\n')).toEqual([
      'model: the key notes (no place in the format)',
      'model: the key notes (not declared by the wire schema)',
      'model: the key notes (reduced to fit the format)',
      'model: the key notes (split by the format)',
      'model: the key notes (not repeated by the codec)',
      'model: the key notes (removed by an edit)',
    ]);
  });

  it('escapes a backslash, so no id renders as another', () => {
    const rendered = (id: string): string =>
      renderDivergences([
        entry(
          { kind: 'element', id: elementIdSchema.parse(id) },
          undeclared('ports'),
          'unrepresentable',
        ),
      ]);
    expect(rendered('a\\u000ab')).toBe(
      'element "a\\\\u000ab": the key ports (no place in the format)',
    );
    expect(rendered('a\nb')).not.toBe(rendered('a\\u000ab'));
  });

  it('escapes a quote inside the quotes it wraps an id in', () => {
    expect(
      renderDivergences([
        entry(
          { kind: 'element', id: elementIdSchema.parse('he said "no"') },
          undeclared('ports'),
          'unrepresentable',
        ),
      ]),
    ).toBe(
      'element "he said \\"no\\"": the key ports (no place in the format)',
    );
  });

  it('escapes the control characters a foreign file carries into a terminal', () => {
    const divergences = [
      entry(
        { kind: 'element', id: elementIdSchema.parse('a\nb') },
        undeclared(`summary${escapeChar}[31m${bellChar}`),
        'unrepresentable',
      ),
    ];
    expect(renderDivergences(divergences).split('\n')).toEqual([
      'element "a\\u000ab": the key summary\\u001b[31m\\u0007 (no place in the format)',
    ]);
  });
});

describe('escapedForTerminal', () => {
  it('closes the control characters a foreign text carries into a terminal', () => {
    expect(escapedForTerminal(`red${escapeChar}[31m${bellChar}`)).toBe(
      'red\\u001b[31m\\u0007',
    );
  });

  it('doubles a backslash, so a text spelling an escape is not one', () => {
    expect(escapedForTerminal('red\\u001b[31m')).toBe('red\\\\u001b[31m');
  });
});
