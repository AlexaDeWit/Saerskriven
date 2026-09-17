import {
  enumeratedCategories,
  parsedFixture,
} from '@saerskriven/model/fixtures';
import {
  severitySchema,
  threatCategorySchema,
  threatStatusSchema,
} from '@saerskriven/model';
import {
  threatDragonWireSchema,
  type ThreatDragonDocument,
} from '@saerskriven/wire-threat-dragon';
import { Either } from 'effect';
import { readFailureIssues } from './codec.fixtures.js';
import { ReadFailure } from './codec.js';
import { renderDivergences } from './divergence.js';
import { readThreatDragon } from './threat-dragon-read.js';
import {
  fromThreatCategory,
  toThreatCategory,
} from './threat-dragon-vocabulary.js';
import {
  complementFixture,
  featureCompleteModel,
  featureCompleteText,
  minimalFixture,
  mitigationTextFixture,
  threatDragonReading,
  unmodelledFixture,
} from './threat-dragon.fixtures.js';
import { unusedConstructs } from './wire-coverage.fixtures.js';

const failureOf = (text: string): ReadFailure =>
  Either.match(readThreatDragon(text), {
    onLeft: (failure) => failure,
    onRight: () => {
      throw new Error('The codec accepted a text it must refuse.');
    },
  });

const nested = (depth: number): string =>
  `${'{"deeper":'.repeat(depth)}1${'}'.repeat(depth)}`;

const featureComplete = threatDragonReading(featureCompleteText);
const complement = threatDragonReading(JSON.stringify(complementFixture));
const minimal = threatDragonReading(JSON.stringify(minimalFixture));
const unmodelled = threatDragonReading(JSON.stringify(unmodelledFixture));

const namedById: ThreatDragonDocument = {
  ...featureComplete.source,
  summary: { ...featureComplete.source.summary, id: 'clinic-booking' },
};

const complementElements = complement.model.diagrams[0]?.elements ?? [];

const elementNamed = (id: string) =>
  [
    ...complementElements,
    ...featureComplete.model.diagrams.flatMap((diagram) => diagram.elements),
  ].find((element) => element.id === id);

const threatDragonMethodologies: readonly string[] =
  enumeratedCategories.flatMap(([methodology, [category]]): string[] => {
    const labelled = toThreatCategory(
      fromThreatCategory(threatCategorySchema.parse({ methodology, category })),
    );
    return labelled.exact && labelled.value.methodology === methodology
      ? [methodology]
      : [];
  });

describe('reading the feature-complete Threat Dragon file', () => {
  it('uses every field, enum value and variant the wire schema declares', () => {
    expect(
      unusedConstructs(threatDragonWireSchema, [
        featureComplete.source,
        namedById,
      ]),
    ).toEqual([]);
  });

  it('reads a summary id given as text as it reads one given as a number', () => {
    expect(threatDragonReading(JSON.stringify(namedById)).model).toEqual(
      featureComplete.model,
    );
  });

  it('holds every threat status, severity and category Threat Dragon labels', () => {
    const { threats } = featureComplete.model;
    expect(threatDragonMethodologies.length).toBeGreaterThan(0);
    expect(new Set(threats.map(({ status }) => status))).toEqual(
      new Set(threatStatusSchema.options),
    );
    expect(new Set(threats.map(({ severity }) => severity))).toEqual(
      new Set(severitySchema.options),
    );
    expect(
      enumeratedCategories
        .filter(([methodology]) =>
          threatDragonMethodologies.includes(methodology),
        )
        .map(([methodology, categories]) => [methodology, new Set(categories)]),
    ).toEqual(
      threatDragonMethodologies.map((methodology) => [
        methodology,
        new Set(
          threats.flatMap(({ category }) =>
            category.methodology === methodology ? [category.category] : [],
          ),
        ),
      ]),
    );
  });

  it('lands as the model written out by hand, compared as one value', () => {
    expect(featureComplete.model).toStrictEqual(
      parsedFixture(featureCompleteModel),
    );
  });

  it('issues up to its highest threat number, 40, where threatTop 30 is below it', () => {
    expect(featureComplete.source.detail.threatTop).toBe(30);
    expect(featureComplete.model.lastIssuedThreatNumber).toBe(40);
  });

  it('issues up to threatTop where threatTop is above its highest threat number', () => {
    const marked: ThreatDragonDocument = {
      ...featureComplete.source,
      detail: { ...featureComplete.source.detail, threatTop: 60 },
    };
    expect(
      threatDragonReading(JSON.stringify(marked)).model.lastIssuedThreatNumber,
    ).toBe(60);
  });

  it('reports the Elevation of Privilege card alone, of which the model holds the suit', () => {
    expect(renderDivergences(featureComplete.divergences)).toBe(
      'threat "threat-card": the Elevation of Privilege card, of which the model holds the suit alone (reduced to fit the format)',
    );
  });

  it('returns the document whole, for a write to merge onto', () => {
    expect(featureComplete.source).toEqual(
      JSON.parse(featureCompleteText) as unknown,
    );
  });
});

describe('reading curves, shared threats and defaults', () => {
  it('draws a boundary curve through its endpoints and its vertices', () => {
    const curve = elementNamed('boundary-curve');
    expect(curve?.kind === 'trust-boundary' && curve.shape).toEqual({
      kind: 'curve',
      waypoints: [
        { x: 0, y: 0 },
        { x: 20, y: 10 },
        { x: 40, y: 40 },
      ],
    });
  });

  it('reads the curve shape name Threat Dragon itself misspells', () => {
    const curve = elementNamed('boundary-typo');
    expect(curve?.kind === 'trust-boundary' && curve.shape.kind).toBe('curve');
  });

  it('names a boundary from its data, or from the label, or not at all', () => {
    expect(elementNamed('boundary-curve')?.name).toBe('Operator zone');
    expect(elementNamed('zone-clinic')?.name).toBe('Clinic network');
    expect(elementNamed('boundary-typo')?.name).toBe('');
  });

  it('joins one threat nested under two cells into one record', () => {
    expect(
      complement.model.threats.map((threat) => [threat.id, threat.elements]),
    ).toEqual([
      ['threat-linkability', ['actor-1', 'store-1']],
      ['threat-ethics', ['store-1']],
    ]);
  });

  it('credits a contributor the file names with an entry and no name', () => {
    expect(complement.model.metadata.contributors).toEqual([
      'Alexandra de Wit',
      '',
    ]);
  });

  it('reads a diagram that holds no cells at all', () => {
    expect(complement.model.diagrams[1]).toEqual({
      id: '5',
      title: 'Nothing drawn yet',
      elements: [],
    });
  });

  it('takes the model default for every field the file leaves out', () => {
    expect(elementNamed('store-1')).toEqual({
      kind: 'store',
      id: 'store-1',
      name: '',
      description: '',
      outOfScope: false,
      reasonOutOfScope: '',
      position: { x: 200, y: 0 },
      size: { width: 100, height: 60 },
    });
    expect(minimal.model).toEqual({
      metadata: {
        title: 'Nothing but a title',
        owner: '',
        description: '',
        contributors: [],
      },
      diagrams: [],
      threats: [],
      lastIssuedThreatNumber: 0,
      mitigations: [],
      assumptions: [],
    });
  });
});

describe('reading the mitigation text of a threat', () => {
  const text = JSON.stringify(mitigationTextFixture);
  const read = threatDragonReading(text);

  it('makes one record of each text, linked to its threat, its status inferred from the threat', () => {
    expect(read.model.mitigations).toEqual([
      {
        id: 'threat-mitigated-mitigation',
        title: '',
        prose: 'Rotate the key.\n\nRevoke it on leave.\r\n  ',
        status: 'implemented',
        threats: ['threat-mitigated'],
      },
      {
        id: 'threat-open-mitigation',
        title: '',
        prose: 'Rate limit the endpoint.',
        status: 'proposed',
        threats: ['threat-open'],
      },
    ]);
  });

  it('diverges in nothing', () => {
    expect(read.divergences).toEqual([]);
  });
});

describe('reading what the model has only just grown a home for', () => {
  it('reads a text block as a note on the canvas, its content its text', () => {
    expect(unmodelled.model.diagrams[0]?.elements[0]).toEqual({
      kind: 'text',
      id: 'text-1',
      name: '',
      description: '',
      outOfScope: false,
      reasonOutOfScope: '',
      position: { x: 0, y: 0 },
      size: { width: 200, height: 100 },
      text: 'Arbitrary Text',
    });
  });

  it('issues a number above the mark to a threat the file left unnumbered', () => {
    expect(
      unmodelled.model.threats.map((threat) => [threat.id, threat.number]),
    ).toEqual([
      ['threat-translated', 5],
      ['threat-unplaceable', 6],
      ['threat-card', 4],
    ]);
    expect(unmodelled.model.lastIssuedThreatNumber).toBe(6);
  });

  it('reports what the model holds less exactly than the file said it', () => {
    expect(renderDivergences(unmodelled.divergences).split('\n')).toEqual([
      'threat "threat-unplaceable": the status "Deferred", which the model has no state for (reduced to fit the format)',
      'threat "threat-unplaceable": the severity "Catastrophic", which the model has no level for (reduced to fit the format)',
      'threat "threat-unplaceable": the category "F\u00e4lschung", which no language of Threat Dragon\'s names (reduced to fit the format)',
      'threat "threat-card": the Elevation of Privilege card, of which the model holds the suit alone (reduced to fit the format)',
    ]);
  });
});

describe('a Threat Dragon read that stops', () => {
  it('refuses text that is not JSON at all', () => {
    const failure = failureOf('{');
    expect(failure._tag).toBe('MalformedText');
    expect(readFailureIssues(failure)).toEqual([]);
  });

  it('refuses a version outside the major it reads', () => {
    const failure = failureOf(
      JSON.stringify({ ...minimalFixture, version: '1.9.9' }),
    );
    expect(failure._tag).toBe('InvalidWireDocument');
    expect(readFailureIssues(failure)).toContainEqual(
      expect.objectContaining({ path: ['version'] }),
    );
  });

  it('refuses a document the wire schema rejects, pathed into the file', () => {
    const failure = failureOf(
      JSON.stringify({
        version: '2.6.2',
        summary: { title: 'Broken' },
        detail: { diagrams: [{ id: 0, title: 'One', diagramType: 'STRIDE' }] },
      }).replace('"diagramType":"STRIDE"', '"diagramType":""'),
    );
    expect(failure._tag).toBe('InvalidWireDocument');
    expect(readFailureIssues(failure)).toContainEqual(
      expect.objectContaining({
        path: ['detail', 'diagrams', 0, 'diagramType'],
      }),
    );
  });

  it('refuses a one-character cell id at the file, not at the model', () => {
    const failure = failureOf(
      JSON.stringify({
        version: '2.6.2',
        summary: { title: 'Shortened' },
        detail: {
          diagrams: [
            {
              id: 0,
              title: 'One',
              diagramType: 'STRIDE',
              cells: [
                {
                  id: 'a',
                  shape: 'process',
                  position: { x: 0, y: 0 },
                  size: { width: 100, height: 100 },
                  data: { type: 'tm.Process' },
                },
              ],
            },
          ],
        },
      }),
    );
    expect(failure._tag).toBe('InvalidWireDocument');
    expect(readFailureIssues(failure)).toContainEqual(
      expect.objectContaining({
        path: ['detail', 'diagrams', 0, 'cells', 0, 'id'],
      }),
    );
  });

  it('refuses a mapping parseModel rejects, pathed into the model', () => {
    const failure = failureOf(
      JSON.stringify({
        version: '2.6.2',
        summary: { title: 'Dangling' },
        detail: {
          diagrams: [
            {
              id: 0,
              title: 'One',
              diagramType: 'STRIDE',
              cells: [
                {
                  id: 'flow-1',
                  shape: 'flow',
                  data: { type: 'tm.Flow' },
                  source: { cell: 'nobody' },
                  target: { cell: 'nobody' },
                },
              ],
            },
          ],
        },
      }),
    );
    expect(failure._tag).toBe('InvalidModel');
    expect(readFailureIssues(failure)).toContainEqual(
      expect.objectContaining({
        path: ['diagrams', 0, 'elements', 0, 'source', 'element'],
      }),
    );
  });

  it('refuses a title carrying a character the model refuses, pathed into the model', () => {
    const failure = failureOf(
      JSON.stringify({
        ...minimalFixture,
        summary: { ...minimalFixture.summary, title: 'Ledger\u202E' },
      }),
    );
    expect(failure._tag).toBe('InvalidModel');
    expect(readFailureIssues(failure)).toContainEqual(
      expect.objectContaining({ path: ['metadata', 'title'] }),
    );
  });

  it('returns a failure rather than throwing on a text nested past any stack', () => {
    expect(
      Either.isLeft(readThreatDragon(`${'['.repeat(3000)}${']'.repeat(3000)}`)),
    ).toBe(true);
  });
});

describe('a Threat Dragon read that strips a key', () => {
  it('reports what the wire schema did not declare, and where it sat', () => {
    const result = threatDragonReading(
      JSON.stringify({
        ...minimalFixture,
        summary: { ...minimalFixture.summary, mystery: 'held by no schema' },
      }),
    );
    expect(renderDivergences(result.divergences)).toBe(
      'model: the key summary.mystery (not declared by the wire schema)',
    );
  });

  it('reports a stripped value without walking into it', () => {
    const result = threatDragonReading(
      `{"version":"2.6.2","summary":{"title":""},"detail":{"diagrams":[]},"mystery":${nested(8)}}`,
    );
    expect(renderDivergences(result.divergences)).toBe(
      'model: the key mystery (not declared by the wire schema)',
    );
  });
});
