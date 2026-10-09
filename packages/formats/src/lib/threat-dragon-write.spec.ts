import {
  moveElement,
  resizeElement,
  type Model,
  type ModelInput,
  type Size,
} from '@saerskriven/model';
import {
  elementId,
  elementIn,
  parsedFixture,
} from '@saerskriven/model/fixtures';
import type {
  ThreatDragonCell,
  ThreatDragonDocument,
} from '@saerskriven/wire-threat-dragon';
import { Ajv } from 'ajv';
import { Either } from 'effect';
import { renderDivergences, type Divergence } from './divergence.js';
import { threatDragonJsonSchema } from './corpus.fixtures.js';
import { threatsOf } from './threat-dragon-document.js';
import {
  allThreats,
  complementFixture,
  featureCompleteModel,
  featureCompleteText,
  richerThanFormatFixture,
  richerThanFormatSource,
  threatDragonReading,
  unmodelledFixture,
} from './threat-dragon.fixtures.js';
import { threatDragonCodec } from './threat-dragon.js';

const validate = new Ajv({ allowUnionTypes: true }).compile(
  threatDragonJsonSchema,
);

const validated = (output: string) => ({
  valid: validate(JSON.parse(output) as unknown),
  errors: validate.errors,
});

const documentOf = (text: string): ThreatDragonDocument =>
  threatDragonReading(text).source;

const numbersIn = (document: ThreatDragonDocument): (number | undefined)[] =>
  allThreats(document).map((threat) => threat.number);

const drawing = (
  title: string,
  cells: ThreatDragonCell[],
  contributors: readonly string[] = [],
): ThreatDragonDocument => ({
  version: '2.6.2',
  summary: { title },
  detail: {
    contributors: contributors.map((name) => ({ name })),
    diagramTop: 1,
    reviewer: '',
    threatTop: 1,
    diagrams: [
      {
        id: 0,
        title: 'One',
        diagramType: 'STRIDE',
        thumbnail: './public/content/images/thumbnail.stride.jpg',
        version: '2.6.2',
        cells,
      },
    ],
  },
});

const featureComplete = threatDragonReading(featureCompleteText);

const richer = parsedFixture(richerThanFormatFixture);

const projected = threatDragonCodec.write(richer);

const movedByHalf = (id: string): Model =>
  Either.getOrThrow(moveElement(richer, elementId(id), { x: 0.5, y: 0.5 }));

const underTen: readonly (readonly [id: string, size: Size])[] = [
  ['element-clerk', { width: 1, height: 80 }],
  ['element-ledger', { width: 5, height: 9.99 }],
  ['element-vault', { width: 160, height: 1 }],
  ['element-zone', { width: 3, height: 3 }],
  ['element-note', { width: 2, height: 2 }],
];

const shrunk = underTen.reduce(
  (model, [id, size]) =>
    Either.getOrThrow(resizeElement(model, elementId(id), size)),
  richer,
);

const isRaisedSize = ({ detail }: Divergence): boolean =>
  detail.code === 'size-raised';

const boxesOf = (text: string) =>
  Object.fromEntries(
    (documentOf(text).detail.diagrams[0]?.cells ?? []).flatMap((cell) =>
      'size' in cell
        ? [[cell.id, { position: cell.position, size: cell.size }]]
        : [],
    ),
  );

const merged = threatDragonCodec.write(richer, richerThanFormatSource);

const mergedDocument = documentOf(merged.output);

const mergedCell = mergedDocument.detail.diagrams[0]?.cells?.[0];

describe('writing the feature-complete model back onto the file it came from', () => {
  const written = threatDragonCodec.write(
    featureComplete.model,
    featureComplete.source,
  );

  it('reads back as the model written out by hand', () => {
    expect(threatDragonReading(written.output).model).toStrictEqual(
      parsedFixture(featureCompleteModel),
    );
  });

  it('leaves the gap at 7 that a removed threat left, unfilled', () => {
    const numbers = numbersIn(documentOf(written.output));
    expect(numbers).not.toContain(7);
    expect(numbers).toEqual(numbersIn(featureComplete.source));
  });

  it('lays the file out as Threat Dragon does, two spaces and a last line', () => {
    expect(written.output.split('\n')[1]).toBe('  "version": "2.6.2",');
    expect(written.output.endsWith('}\n')).toBe(true);
  });
});

describe('writing a threat the file left unnumbered', () => {
  const source = documentOf(JSON.stringify(unmodelledFixture));
  const read = threatDragonReading(JSON.stringify(unmodelledFixture));
  const written = threatDragonCodec.write(read.model, source);
  const document = documentOf(written.output);

  it('writes the number the read issued above the file own high mark', () => {
    expect(numbersIn(source)).toEqual([undefined, undefined, 4]);
    expect(numbersIn(document)).toEqual([5, 6, 4]);
  });

  it('writes a mark that covers it where the file declared none at all', () => {
    expect(source.detail.threatTop).toBeUndefined();
    expect(document.detail.threatTop).toBe(6);
    expect(renderDivergences(written.divergences).split('\n')).toEqual([
      'model: the release "2.0" the source was written by, for the 2.6.2 this codec writes (not repeated by the codec)',
      'diagram "0": the release "2.0" the source was written by, for the 2.6.2 this codec writes (not repeated by the codec)',
    ]);
  });
});

describe('projecting a model the format is smaller than', () => {
  it('names every place the model and the file it wrote do not correspond', () => {
    expect(renderDivergences(projected.divergences).split('\n')).toEqual([
      'diagram "perimeter-review": the name, which the format numbers a diagram rather than naming one, written as 1 (no place in the format)',
      'element "element-zone": the out-of-scope marking, which the format records on the elements a threat attaches to alone (no place in the format)',
      'element "element-note": the name "Review note", which the format has one text for a note and no name beside it (no place in the format)',
      'threat "threat-split": the one record, written once under each of the 2 elements it names (split by the format)',
      'threat "threat-privacy": the PLOT4ai category "cybersecurity", which Threat Dragon\'s own labels do not name (reduced to fit the format)',
      'threat "threat-zone": the attachment to the trust boundary "element-zone", which the format nests a threat under an actor, a process, a store, or a flow alone (no place in the format)',
      'threat "threat-zone": the threat itself, which the format holds nowhere but under a cell and this one names none it can nest under (no place in the format)',
      'threat "threat-unattached": the threat itself, which the format holds nowhere but under a cell and this one names none it can nest under (no place in the format)',
      'threat "threat-split": the mitigation title written into its one mitigation text, which reads back as one record with no title (reduced to fit the format)',
      'assumption "assumption-vault-audited": the assumption, which the format keeps no record of (no place in the format)',
    ]);
  });

  it('writes a file Threat Dragon validates as one of its own', () => {
    expect(validated(projected.output)).toEqual({ valid: true, errors: null });
  });

  it.each([
    ['a free flow end', 'element-post'],
    ['a boundary curve', 'element-perimeter'],
  ])(
    'writes one it validates with %s moved half a unit, and reports no more',
    (_name, id) => {
      const written = threatDragonCodec.write(movedByHalf(id));
      expect(validated(written.output)).toEqual({ valid: true, errors: null });
      expect(written.divergences).toEqual(projected.divergences);
    },
  );

  it('nests the one threat two elements share under each of them', () => {
    const cells = documentOf(projected.output).detail.diagrams[0]?.cells ?? [];
    expect(
      cells.flatMap((cell) =>
        threatsOf(cell).map((threat) => `${cell.id}: ${threat.id}`),
      ),
    ).toEqual([
      'element-clerk: threat-privacy',
      'element-ledger: threat-split',
      'element-vault: threat-split',
    ]);
  });

  it('numbers a diagram the model named, and takes the number where it is one', () => {
    expect(
      documentOf(projected.output).detail.diagrams.map((diagram) => diagram.id),
    ).toEqual([0, 1]);
  });

  it('carries the model over, all but what it reported losing', () => {
    const back = threatDragonReading(projected.output).model;
    expect(back.metadata).toEqual(richer.metadata);
    expect(back.threats.map((threat) => threat.id)).toEqual([
      'threat-privacy',
      'threat-split',
    ]);
    expect(back.threats[0]?.category).toEqual({
      methodology: 'custom',
      methodologyName: 'PLOT4ai',
      category: 'cybersecurity',
    });
    expect(back.lastIssuedThreatNumber).toBe(9);
  });

  it('takes the format release and the mark the model can spare no room for', () => {
    const document = documentOf(projected.output);
    expect(document.version).toBe('2.6.2');
    expect(document.detail.threatTop).toBe(9);
    expect(document.detail.diagramTop).toBe(2);
  });
});

describe('projecting elements under the 10 Threat Dragon takes as its least width and height', () => {
  const held = structuredClone(shrunk);
  const written = threatDragonCodec.write(shrunk);

  it('writes a file Threat Dragon validates as one of its own', () => {
    expect(validated(written.output)).toEqual({ valid: true, errors: null });
  });

  it('writes each extent under 10 as 10, and every position as the model holds it', () => {
    expect(boxesOf(written.output)).toEqual({
      'element-clerk': {
        position: { x: 40, y: 40 },
        size: { width: 10, height: 80 },
      },
      'element-ledger': {
        position: { x: 320, y: 40 },
        size: { width: 10, height: 10 },
      },
      'element-vault': {
        position: { x: 600, y: 40 },
        size: { width: 160, height: 10 },
      },
      'element-zone': {
        position: { x: 560, y: 10 },
        size: { width: 10, height: 10 },
      },
      'element-note': {
        position: { x: 40, y: 240 },
        size: { width: 10, height: 10 },
      },
    });
  });

  it('names each element it raised once, beside what the projection reports anyway', () => {
    expect(
      renderDivergences(written.divergences.filter(isRaisedSize)).split('\n'),
    ).toEqual([
      'element "element-clerk": the size 1 by 80, written as 10 by 80 to meet Threat Dragon\'s minimum (no place in the format)',
      'element "element-ledger": the size 5 by 9.99, written as 10 by 10 to meet Threat Dragon\'s minimum (no place in the format)',
      'element "element-vault": the size 160 by 1, written as 160 by 10 to meet Threat Dragon\'s minimum (no place in the format)',
      'element "element-zone": the size 3 by 3, written as 10 by 10 to meet Threat Dragon\'s minimum (no place in the format)',
      'element "element-note": the size 2 by 2, written as 10 by 10 to meet Threat Dragon\'s minimum (no place in the format)',
    ]);
    expect(
      written.divergences.filter((divergence) => !isRaisedSize(divergence)),
    ).toEqual(projected.divergences);
  });

  it('leaves the model as it was', () => {
    expect(shrunk).toEqual(held);
  });

  it('reads back at the sizes it wrote, which a write of that reading reports nothing of', () => {
    const back = threatDragonReading(written.output);
    expect(elementIn(back.model, 'element-ledger')).toMatchObject({
      size: { width: 10, height: 10 },
    });
    expect(
      threatDragonCodec
        .write(back.model, back.source)
        .divergences.filter(isRaisedSize),
    ).toEqual([]);
  });
});

describe('writing back a file whose own cell is under 10 across', () => {
  const held: ThreatDragonCell = {
    id: 'cell-small',
    shape: 'process',
    zIndex: 3,
    position: { x: 12.5, y: 20 },
    size: { width: 4, height: 60 },
    attrs: {
      body: { stroke: '#333333', strokeWidth: 1.5, strokeDasharray: null },
    },
    data: { type: 'tm.Process', name: 'Held small', hasOpenThreats: false },
  };
  const read = threatDragonReading(
    JSON.stringify(drawing('Held small', [held])),
  );
  const written = threatDragonCodec.write(read.model, read.source);

  it('raises it in a file Threat Dragon validates, and keeps the rest of the cell', () => {
    expect(validated(written.output)).toEqual({ valid: true, errors: null });
    expect(documentOf(written.output).detail.diagrams[0]?.cells?.[0]).toEqual({
      ...held,
      size: { width: 10, height: 60 },
    });
  });

  it('reports the size it wrote over, and nothing once the file holds 10', () => {
    expect(renderDivergences(written.divergences)).toBe(
      'element "cell-small": the size 4 by 60, written as 10 by 60 to meet Threat Dragon\'s minimum (not repeated by the codec)',
    );
    const again = threatDragonReading(written.output);
    expect(
      threatDragonCodec.write(again.model, again.source).divergences,
    ).toEqual([]);
  });
});

describe('merging a model onto the document it is written over', () => {
  it('keeps the styling, ports and score no part of the model holds', () => {
    expect(mergedCell).toMatchObject({
      id: 'element-clerk',
      zIndex: 4,
      attrs: {
        body: { stroke: '#333333', strokeWidth: 1.5, strokeDasharray: null },
      },
      ports: { items: [{ group: 'top', id: 'port-1' }] },
      data: { hasOpenThreats: true },
    });
    expect(
      mergedCell?.shape === 'actor' && mergedCell.data.threats?.[0]?.score,
    ).toBe('7');
  });

  it('rewrites the category the edit changed and leaves the rest alone', () => {
    expect(
      mergedCell?.shape === 'actor' && mergedCell.data.threats,
    ).toMatchObject([
      { id: 'threat-privacy', modelType: 'PLOT4ai', type: 'cybersecurity' },
    ]);
  });

  it('names what the edit cost the document beside what the format cannot hold', () => {
    expect(renderDivergences(merged.divergences).split('\n')).toEqual([
      'model: the release "2.0.0" the source was written by, for the 2.6.2 this codec writes (not repeated by the codec)',
      'model: the threat high-water mark 3, raised to 9, the highest number the model has issued and no number in the file reaches (not repeated by the codec)',
      'model: the diagram high-water mark 8, raised to 9 to cover a number this write issued (not repeated by the codec)',
      'diagram "perimeter-review": the name, which the format numbers a diagram rather than naming one, written as 8 (no place in the format)',
      'diagram "0": the release "2.0.0" the source was written by, for the 2.6.2 this codec writes (not repeated by the codec)',
      'element "element-zone": the out-of-scope marking, which the format records on the elements a threat attaches to alone (no place in the format)',
      'element "element-note": the name "Review note", which the format has one text for a note and no name beside it (no place in the format)',
      'element "element-gone": the store cell the source document held (removed by an edit)',
      'threat "threat-split": the one record, written once under each of the 2 elements it names (split by the format)',
      'threat "threat-privacy": the PLOT4ai category "cybersecurity", which Threat Dragon\'s own labels do not name (reduced to fit the format)',
      'threat "threat-zone": the attachment to the trust boundary "element-zone", which the format nests a threat under an actor, a process, a store, or a flow alone (no place in the format)',
      'threat "threat-zone": the threat itself, which the format holds nowhere but under a cell and this one names none it can nest under (no place in the format)',
      'threat "threat-unattached": the threat itself, which the format holds nowhere but under a cell and this one names none it can nest under (no place in the format)',
      'threat "threat-split": the mitigation title written into its one mitigation text, which reads back as one record with no title (reduced to fit the format)',
      'assumption "assumption-vault-audited": the assumption, which the format keeps no record of (no place in the format)',
      'diagram "7": the diagram "An older sketch" the source document held (removed by an edit)',
      'threat "threat-gone": the threat "A threat an edit has since removed" the source document nested under a cell the model kept (removed by an edit)',
    ]);
  });

  it('keeps the summary and the review the model never described', () => {
    expect(mergedDocument.summary).toEqual({
      title: 'Ledger',
      id: 4,
      tags: ['finance'],
      owner: 'Alexandra de Wit',
      description: 'Richer than the format it is written to.',
    });
    expect(mergedDocument.detail.reviewer).toBe('Jonas Lindqvist');
  });

  it('numbers the diagram the edit added from the mark the file kept', () => {
    expect(mergedDocument.detail.diagrams.map((diagram) => diagram.id)).toEqual(
      [0, 8],
    );
    expect(mergedDocument.detail.diagramTop).toBe(9);
  });

  it('drops the diagram and the cell the edit removed', () => {
    expect(
      mergedDocument.detail.diagrams[0]?.cells?.map((cell) => cell.id),
    ).toEqual([
      'element-clerk',
      'element-ledger',
      'element-vault',
      'element-post',
      'element-zone',
      'element-note',
    ]);
  });

  it('writes a file Threat Dragon validates as one of its own', () => {
    expect(validated(merged.output)).toEqual({ valid: true, errors: null });
  });
});

describe('merging curves, notes, cards and translated labels', () => {
  it.each([
    ['a curve under either spelling', complementFixture],
    ['a note, a card and a translated label', unmodelledFixture],
  ])('leaves %s as the document had it', (_name, fixture) => {
    const text = JSON.stringify(fixture);
    const read = threatDragonReading(text);
    const written = threatDragonCodec.write(read.model, read.source);
    expect(threatDragonReading(written.output).model).toEqual(read.model);
  });

  it('reports nothing on a threat the document already nested twice', () => {
    const read = threatDragonReading(JSON.stringify(complementFixture));
    const written = threatDragonCodec.write(read.model, read.source);
    expect(read.model.threats[0]?.elements).toHaveLength(2);
    expect(renderDivergences(written.divergences).split('\n')).toEqual([
      'model: the release "2.0.0" the source was written by, for the 2.6.2 this codec writes (not repeated by the codec)',
      'diagram "4": the release "2.0.0" the source was written by, for the 2.6.2 this codec writes (not repeated by the codec)',
    ]);
  });

  it('marks a document that declared none over the numbers it holds', () => {
    const read = threatDragonReading(JSON.stringify(complementFixture));
    const written = documentOf(
      threatDragonCodec.write(read.model, read.source).output,
    );
    expect(complementFixture.detail.threatTop).toBeUndefined();
    expect(complementFixture.detail.diagramTop).toBeUndefined();
    expect(numbersIn(written)).toEqual([3, 3, 4]);
    expect(written.detail.diagrams.map((diagram) => diagram.id)).toEqual([
      4, 5,
    ]);
    expect(written.detail.threatTop).toBe(4);
    expect(written.detail.diagramTop).toBe(6);
  });

  it('keeps the misspelled curve shape Threat Dragon registers itself', () => {
    const read = threatDragonReading(JSON.stringify(complementFixture));
    const written = threatDragonCodec.write(read.model, read.source);
    expect(
      documentOf(written.output).detail.diagrams[0]?.cells?.map(
        (cell) => cell.shape,
      ),
    ).toEqual([
      'trust-boundary-curve',
      'trust-broundary-curve',
      'actor',
      'store',
      'flow',
    ]);
  });

  it('leaves a diagram that draws nothing without a cell list', () => {
    const read = threatDragonReading(JSON.stringify(complementFixture));
    const written = threatDragonCodec.write(read.model, read.source);
    expect(
      documentOf(written.output).detail.diagrams[1]?.cells,
    ).toBeUndefined();
  });

  it('leaves the severity spelling the file chose of the two it reads', () => {
    const read = threatDragonReading(JSON.stringify(unmodelledFixture));
    const written = threatDragonCodec.write(read.model, read.source);
    expect(
      allThreats(documentOf(written.output)).map((threat) => [
        threat.severity,
        threat.status,
        threat.type,
      ]),
    ).toEqual([
      ['TBA', 'Accepted', 'Manipulation'],
      ['Catastrophic', 'Deferred', 'Fälschung'],
      ['TBD', 'Open', null],
    ]);
  });
});

describe('a merge onto a document an edit has moved out from under', () => {
  const source = drawing(
    'Edited',
    [
      {
        id: 'element-one',
        shape: 'actor',
        zIndex: 3,
        position: { x: 10, y: 10 },
        size: { width: 100, height: 60 },
        data: {
          type: 'tm.Actor',
          name: 'Was an actor',
          hasOpenThreats: true,
          threats: [
            {
              id: 'threat-held',
              number: 1,
              title: 'Held by the file',
              modelType: 'STRIDE',
              type: 'Spoofing',
              status: 'Open',
              severity: 'High',
              description: '',
              mitigation: '',
            },
          ],
        },
      },
    ],
    ['Alexandra de Wit'],
  );

  const edited = parsedFixture({
    metadata: {
      title: 'Edited',
      owner: '',
      description: '',
      contributors: ['Alexandra de Wit'],
    },
    diagrams: [
      {
        id: '0',
        title: 'One',
        elements: [
          {
            kind: 'store',
            id: 'element-one',
            name: 'Now a store',
            description: '',
            outOfScope: false,
            reasonOutOfScope: '',
            position: { x: 10, y: 10 },
            size: { width: 100, height: 60 },
          },
        ],
      },
    ],
    threats: [
      {
        id: 'threat-held',
        number: 1,
        title: 'Held by the file',
        category: { methodology: 'STRIDE', category: 'spoofing' },
        severity: 'high',
        status: 'open',
        description: '',
        elements: ['element-one'],
        appliesToModel: false,
      },
      {
        id: 'threat-added',
        number: 4,
        title: 'Added by the edit',
        category: { methodology: 'STRIDE', category: 'tampering' },
        severity: 'low',
        status: 'open',
        description: '',
        elements: ['element-one'],
        appliesToModel: false,
      },
    ],
    lastIssuedThreatNumber: 4,
    mitigations: [],
    assumptions: [],
  } satisfies ModelInput);

  const written = threatDragonCodec.write(edited, source);
  const document = documentOf(written.output);

  it('draws the cell afresh where the element is no longer that shape', () => {
    expect(document.detail.diagrams[0]?.cells?.[0]).toMatchObject({
      shape: 'store',
      zIndex: 1,
      data: { type: 'tm.Store', name: 'Now a store' },
    });
  });

  it('says what the cell it redrew was carrying', () => {
    expect(renderDivergences(written.divergences).split('\n')).toEqual([
      'model: the threat high-water mark 1, raised to 4 to cover a number this write issued (not repeated by the codec)',
      'element "element-one": what the source held on the actor cell of this id, which now draws a store (removed by an edit)',
    ]);
  });

  it('nests the threat the edit added after the one the file already held', () => {
    expect(numbersIn(document)).toEqual([1, 4]);
    expect(allThreats(document).map((threat) => threat.id)).toEqual([
      'threat-held',
      'threat-added',
    ]);
  });
});

const cell = (id: string, score: string, fresh: boolean) => ({
  id,
  shape: 'process' as const,
  zIndex: 1,
  position: { x: 0, y: 0 },
  size: { width: 10, height: 10 },
  data: {
    type: 'tm.Process' as const,
    threats: [
      {
        id: 'threat-1',
        number: 1,
        title: 'Held under both cells',
        modelType: 'STRIDE',
        type: 'Tampering',
        status: 'Open',
        severity: 'High',
        description: '',
        mitigation: '',
        score,
        new: fresh,
      },
    ],
  },
});

const element = (id: string) => ({
  kind: 'process' as const,
  id,
  name: '',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  position: { x: 0, y: 0 },
  size: { width: 10, height: 10 },
});

describe('a threat an edit detached from one of the cells holding it', () => {
  const source = drawing('Detached', [
    cell('cell-a', '7', false),
    cell('cell-b', '9', true),
  ]);

  const detached = parsedFixture({
    metadata: {
      title: 'Detached',
      owner: '',
      description: '',
      contributors: [],
    },
    diagrams: [
      {
        id: '0',
        title: 'One',
        elements: [element('cell-a'), element('cell-b')],
      },
    ],
    threats: [
      {
        id: 'threat-1',
        number: 1,
        title: 'Held under both cells',
        category: { methodology: 'STRIDE', category: 'tampering' },
        severity: 'high',
        status: 'open',
        description: '',
        elements: ['cell-a'],
        appliesToModel: false,
      },
    ],
    lastIssuedThreatNumber: 1,
    mitigations: [],
    assumptions: [],
  } satisfies ModelInput);

  const written = threatDragonCodec.write(detached, source);
  const cells = documentOf(written.output).detail.diagrams[0]?.cells ?? [];

  it('keeps the copy under the cell the model still attaches it to', () => {
    expect(threatsOf(cells[0]).map((threat) => threat.score)).toEqual(['7']);
  });

  it('drops the copy under the cell it no longer attaches it to', () => {
    expect(threatsOf(cells[1])).toEqual([]);
  });

  it('says which cell the copy it dropped was nested under', () => {
    expect(renderDivergences(written.divergences)).toBe(
      'threat "threat-1": the copy the source document nested under the cell "cell-b", which the model no longer attaches it to (removed by an edit)',
    );
  });
});
