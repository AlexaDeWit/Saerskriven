import {
  threatDragonWireSchema,
  type ThreatDragonDocument,
  type ThreatDragonThreat,
} from './threat-dragon-wire.js';

const translated: ThreatDragonThreat = {
  id: 'threat-translated',
  title: 'Manipulation der Anfrage',
  modelType: 'STRIDE',
  type: 'Manipulation',
  status: 'Accepted',
  severity: 'TBA',
  description: '',
  mitigation: '',
};

const card: ThreatDragonThreat = {
  id: 'threat-card',
  number: 4,
  title: 'The attacker reads the session token',
  modelType: 'EOP',
  type: null,
  eopGameId: 'cornucopia',
  cardSuit: 'Data Validation & Encoding',
  cardNumber: '3',
  status: 'Open',
  severity: 'TBD',
  description: '',
  mitigation: '',
};

const minimal: ThreatDragonDocument = {
  version: '2.9.13',
  summary: { title: 'Nothing but a title' },
  detail: { diagrams: [] },
};

const unmodelled: ThreatDragonDocument = {
  version: '2.0',
  summary: { title: 'Beyond the model' },
  detail: {
    diagrams: [
      {
        id: 0,
        title: 'Zahlungen',
        diagramType: 'STRIDE',
        version: '2.0',
        cells: [
          {
            id: 'text-1',
            shape: 'td-text-block',
            position: { x: 0, y: 0 },
            size: { width: 200, height: 100 },
            attrs: { text: { text: 'Arbitrary Text' } },
            data: { type: 'tm.Text', name: 'Arbitrary Text' },
          },
          {
            id: 'boundary-typo',
            shape: 'trust-broundary-curve',
            data: { type: 'tm.Boundary' },
            source: { x: 0, y: 60 },
            target: { x: 40, y: 60 },
          },
          {
            id: 'process-1',
            shape: 'process',
            position: { x: 0, y: 200 },
            size: { width: 100, height: 100 },
            data: {
              type: 'tm.Process',
              name: 'Zahlungsdienst',
              threats: [translated, card],
            },
          },
          {
            id: 'flow-1',
            shape: 'flow',
            data: { type: 'tm.Flow' },
            source: { cell: 'process-1' },
            target: { x: 300, y: 300 },
          },
        ],
      },
    ],
  },
};

function parsedOf(value: unknown) {
  const result = threatDragonWireSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

function issuePathsOf(value: unknown) {
  const result = threatDragonWireSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

function withCells(cells: readonly unknown[]): unknown {
  return {
    ...minimal,
    detail: {
      diagrams: [{ id: 0, title: 'One', diagramType: 'STRIDE', cells }],
    },
  };
}

function withSummaryId(id: unknown): unknown {
  return { ...minimal, summary: { ...minimal.summary, id } };
}

function processCell(id: string, threats: readonly unknown[]): unknown {
  return {
    id,
    shape: 'process',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    data: { type: 'tm.Process', threats },
  };
}

describe('the Threat Dragon wire schema', () => {
  it('reads a file holding nothing but what the format requires', () => {
    expect(parsedOf(minimal)).toEqual(minimal);
  });

  it('reads a two-part version, an unnumbered, translated and EOP threat, and the misspelled curve whole', () => {
    expect(parsedOf(unmodelled)).toEqual(unmodelled);
  });

  it('refuses a file stamped outside the major it reads, at that path', () => {
    expect(issuePathsOf({ ...minimal, version: '1.6.2' })).toEqual([
      ['version'],
    ]);
    expect(
      issuePathsOf({
        ...minimal,
        detail: {
          diagrams: [
            { id: 0, title: 'One', diagramType: 'STRIDE', version: '3.0.0' },
          ],
        },
      }),
    ).toEqual([['detail', 'diagrams', 0, 'version']]);
  });

  it('drops a key it does not declare rather than refusing the file', () => {
    expect(parsedOf({ ...minimal, mystery: 'a later Threat Dragon' })).toEqual(
      minimal,
    );
  });

  it.each([
    {
      named: 'a cell id',
      document: withCells([processCell('a', [])]),
      path: ['detail', 'diagrams', 0, 'cells', 0, 'id'],
    },
    {
      named: 'a threat id',
      document: withCells([
        processCell('process-1', [{ ...translated, id: 'a' }]),
      ]),
      path: ['detail', 'diagrams', 0, 'cells', 0, 'data', 'threats', 0, 'id'],
    },
    {
      named: 'the cell an edge is anchored to',
      document: withCells([
        {
          id: 'flow-1',
          shape: 'flow',
          data: { type: 'tm.Flow' },
          source: { cell: 'a' },
          target: { cell: 'process-1' },
        },
      ]),
      path: ['detail', 'diagrams', 0, 'cells', 0, 'source', 'cell'],
    },
    {
      named: 'a summary id',
      document: withSummaryId('a'),
      path: ['summary', 'id'],
    },
  ])('refuses $named of one character, at that path', ({ document, path }) => {
    expect(issuePathsOf(document)).toEqual([path]);
  });

  it('reads a summary id written as an integer and one written as a string', () => {
    expect(parsedOf(withSummaryId(0))?.summary.id).toBe(0);
    expect(parsedOf(withSummaryId('ab'))?.summary.id).toBe('ab');
  });
});
