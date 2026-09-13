import { Either } from 'effect';
import { diagramId, elementId, parsedFixture } from '../fixtures.js';
import { validModelFixture } from './fixtures.js';
import {
  fragmentRecordCounts,
  insertFragment,
  remapFragment,
  selectionFragment,
} from './fragment.js';
import { unlinkMitigation } from './mitigation-operations.js';
import { parseModel, type Model } from './parse.js';

const model = parsedFixture(validModelFixture);
const diagram = diagramId('diagram-main');

it('copies related records once, excludes external links, and does not change the source', () => {
  const before = structuredClone(model);
  const fragment = Either.getOrThrow(
    selectionFragment(model, diagram, [elementId('element-api')]),
  );
  expect(fragment.diagrams[0].elements.map((element) => element.id)).toEqual([
    'element-api',
  ]);
  expect(fragment.threats.length).toBeGreaterThan(0);
  expect(fragment.threats[0].elements).toEqual(['element-api']);
  expect(fragment.mitigations.length).toBeGreaterThan(0);
  expect(fragment.assumptions.length).toBeGreaterThan(0);
  expect(Either.isRight(parseModel(fragment))).toBe(true);
  expect(model).toEqual(before);
});

it('copies an assumption only through a copied threat that links it', () => {
  const unthreatened = Either.getOrThrow(
    selectionFragment(model, diagram, [elementId('element-db')]),
  );
  expect(unthreatened.threats).toEqual([]);
  expect(unthreatened.assumptions).toEqual([]);
  const threatened = Either.getOrThrow(
    selectionFragment(model, diagram, [elementId('element-api')]),
  );
  expect(threatened.assumptions).toEqual(model.assumptions);
});

it('copies an assumption without the model link its source holds', () => {
  const modelWide = parsedFixture({
    ...validModelFixture,
    assumptions: validModelFixture.assumptions.map((assumption) => ({
      ...assumption,
      appliesToModel: true,
    })),
  });
  const fragment = Either.getOrThrow(
    selectionFragment(modelWide, diagram, [elementId('element-api')]),
  );
  expect(fragment.assumptions).toEqual(model.assumptions);
});

it('includes the endpoint of a selected flow and keeps its free endpoint', () => {
  const flow = model.diagrams[0].elements.find(
    (element) => element.kind === 'flow',
  );
  expect(flow?.kind).toBe('flow');
  if (flow?.kind !== 'flow') {
    return;
  }
  const fragment = Either.getOrThrow(
    selectionFragment(model, diagram, [flow.id]),
  );
  expect(fragment.diagrams[0].elements).toContainEqual(flow);
  expect(fragment.diagrams[0].elements.map((element) => element.id)).toEqual(
    expect.arrayContaining(['element-order-flow', 'element-customer']),
  );
  expect(Either.isRight(parseModel(fragment))).toBe(true);
});

it('remaps references and geometry, issues new numbers, and rejects an ID collision atomically', () => {
  const fragment = Either.getOrThrow(
    selectionFragment(
      model,
      diagram,
      model.diagrams[0].elements.map((element) => element.id),
    ),
  );
  const fresh = Either.getOrThrow(
    remapFragment(fragment, 'fresh', { x: 20, y: 30 }, model),
  );
  const inserted = Either.getOrThrow(insertFragment(model, diagram, fresh));
  expect(
    inserted.threats.slice(model.threats.length).map((threat) => threat.number),
  ).toEqual(
    fragment.threats.map(
      (_, index) => model.lastIssuedThreatNumber + index + 1,
    ),
  );
  expect(
    inserted.diagrams[0].elements
      .slice(model.diagrams[0].elements.length)
      .every((element) => element.id.startsWith('fresh:')),
  ).toBe(true);
  expect(Either.isRight(parseModel(inserted))).toBe(true);
  expect(Either.isLeft(insertFragment(inserted, diagram, fresh))).toBe(true);
  expect(fresh.diagrams[0].elements[0]).toMatchObject({
    position: { x: 60, y: 150 },
  });
});

it('includes flows between selected nodes and refuses missing graph references before insertion', () => {
  const input = structuredClone(validModelFixture);
  const flow = input.diagrams[0].elements.find(
    (element) => element.kind === 'flow',
  );
  if (flow?.kind !== 'flow') {
    throw new Error('The fixture has no flow.');
  }
  flow.target = { kind: 'attached', element: 'element-api' };
  const connected = parsedFixture(input);
  const fragment = Either.getOrThrow(
    selectionFragment(connected, diagram, [
      elementId('element-customer'),
      elementId('element-api'),
    ]),
  );
  expect(fragment.diagrams[0].elements.map((element) => element.id)).toContain(
    'element-order-flow',
  );
  expect(
    Either.isLeft(selectionFragment(model, diagramId('missing'), [])),
  ).toBe(true);
  expect(
    Either.isLeft(selectionFragment(model, diagram, [elementId('missing')])),
  ).toBe(true);
  expect(
    Either.isLeft(insertFragment(model, diagramId('missing'), fragment)),
  ).toBe(true);
  const empty = Either.getOrThrow(selectionFragment(model, diagram, []));
  expect(Either.getOrThrow(insertFragment(model, diagram, empty))).toBe(model);
});

const tamper = 'threat-tamper-order';

function pasted(source: Model, target: Model) {
  const fragment = Either.getOrThrow(
    selectionFragment(source, diagram, [elementId('element-api')]),
  );
  const remapped = Either.getOrThrow(
    remapFragment(fragment, 'pasted', { x: 20, y: 20 }, target),
  );
  const counts = fragmentRecordCounts(target, remapped);
  const inserted = Either.getOrThrow(insertFragment(target, diagram, remapped));
  const threat = inserted.threats.at(-1)?.id;
  return { inserted, counts, threat };
}

function modelWith(
  records: Pick<typeof validModelFixture, 'mitigations' | 'assumptions'>,
): Model {
  return parsedFixture({ ...validModelFixture, ...records });
}

const [mitigation] = validModelFixture.mitigations;
const [assumption] = validModelFixture.assumptions;

it('links a pasted threat to identical records the model holds', () => {
  const { inserted, counts, threat } = pasted(model, model);
  expect(inserted.mitigations).toEqual([
    { ...model.mitigations[0], threats: [tamper, threat] },
  ]);
  expect(inserted.assumptions).toEqual([
    { ...model.assumptions[0], threats: [tamper, threat] },
  ]);
  expect(counts).toEqual({ linked: 2, cloned: 0 });
});

it.each<[string, Partial<typeof mitigation>]>([
  ['prose', { prose: 'Edited.' }],
  ['status', { status: 'implemented' }],
  ['title', { title: 'Edited' }],
])('clones a mitigation whose %s changed between copy and paste', (_, edit) => {
  const edited = modelWith({
    mitigations: [{ ...mitigation, ...edit }],
    assumptions: validModelFixture.assumptions,
  });
  const { inserted, counts, threat } = pasted(model, edited);
  expect(inserted.mitigations).toEqual([
    edited.mitigations[0],
    { ...model.mitigations[0], id: 'pasted:mitigation-tls', threats: [threat] },
  ]);
  expect(counts).toEqual({ linked: 1, cloned: 1 });
});

it('clones a record the model no longer holds', () => {
  const culled = Either.getOrThrow(
    unlinkMitigation(model, model.mitigations[0].id, model.threats[0].id),
  );
  expect(culled.mitigations).toEqual([]);
  const { inserted, threat } = pasted(model, culled);
  expect(inserted.mitigations).toEqual([
    { ...model.mitigations[0], id: 'pasted:mitigation-tls', threats: [threat] },
  ]);
});

it('links to an identical record another model holds and clones into one without it', () => {
  const other = parsedFixture({
    ...validModelFixture,
    threats: [{ ...validModelFixture.threats[0], id: 'threat-other' }],
    mitigations: [{ ...mitigation, threats: ['threat-other'] }],
    assumptions: [{ ...assumption, threats: ['threat-other'] }],
  });
  const linked = pasted(model, other);
  expect(linked.inserted.mitigations).toEqual([
    { ...other.mitigations[0], threats: ['threat-other', linked.threat] },
  ]);
  expect(linked.inserted.assumptions).toEqual([
    { ...other.assumptions[0], threats: ['threat-other', linked.threat] },
  ]);
  const cloned = pasted(model, modelWith({ mitigations: [], assumptions: [] }));
  expect(cloned.inserted.mitigations).toEqual([
    {
      ...model.mitigations[0],
      id: 'pasted:mitigation-tls',
      threats: [cloned.threat],
    },
  ]);
  expect(cloned.inserted.assumptions).toEqual([
    {
      ...model.assumptions[0],
      id: 'pasted:assumption-managed-db',
      threats: [cloned.threat],
    },
  ]);
  expect(cloned.counts).toEqual({ linked: 0, cloned: 2 });
});

it('links to a model-scoped assumption that keeps its model link, and clones one without it', () => {
  const modelWide = modelWith({
    mitigations: [],
    assumptions: [{ ...assumption, appliesToModel: true }],
  });
  const linked = pasted(modelWide, modelWide);
  expect(linked.inserted.assumptions).toEqual([
    { ...modelWide.assumptions[0], threats: [tamper, linked.threat] },
  ]);
  const cloned = pasted(
    modelWide,
    modelWith({ mitigations: [], assumptions: [] }),
  );
  expect(cloned.inserted.assumptions).toEqual([
    {
      ...modelWide.assumptions[0],
      id: 'pasted:assumption-managed-db',
      threats: [cloned.threat],
      appliesToModel: false,
    },
  ]);
});

it('links an assumption whose only difference is the model link', () => {
  const modelWide = modelWith({
    mitigations: [],
    assumptions: [{ ...assumption, appliesToModel: true }],
  });
  const { inserted, counts, threat } = pasted(model, modelWide);
  expect(inserted.assumptions).toEqual([
    { ...modelWide.assumptions[0], threats: [tamper, threat] },
  ]);
  expect(counts).toEqual({ linked: 1, cloned: 1 });
});

it('pastes no model-scoped assumption that no copied threat links', () => {
  const modelWide = modelWith({
    mitigations: validModelFixture.mitigations,
    assumptions: [{ ...assumption, threats: [], appliesToModel: true }],
  });
  const empty = modelWith({ mitigations: [], assumptions: [] });
  const { inserted } = pasted(modelWide, empty);
  expect(inserted.assumptions).toEqual([]);
});

it('refuses a copied record that shares an id with a different record', () => {
  const fragment = Either.getOrThrow(
    selectionFragment(model, diagram, [elementId('element-api')]),
  );
  const remapped = Either.getOrThrow(
    remapFragment(fragment, 'pasted', { x: 0, y: 0 }, model),
  );
  const edited = modelWith({
    mitigations: [{ ...mitigation, prose: 'Edited.' }],
    assumptions: validModelFixture.assumptions,
  });
  expect(Either.isLeft(insertFragment(edited, diagram, remapped))).toBe(true);
});

it('pastes no model link and no record that links no pasted threat', () => {
  const fragment = Either.getOrThrow(
    selectionFragment(model, diagram, [elementId('element-api')]),
  );
  const crafted = parsedFixture({
    ...fragment,
    assumptions: [
      { ...assumption, appliesToModel: true },
      {
        ...assumption,
        id: 'assumption-unlinked',
        threats: [],
        appliesToModel: true,
      },
    ],
  });
  const empty = modelWith({ mitigations: [], assumptions: [] });
  const remapped = Either.getOrThrow(
    remapFragment(crafted, 'pasted', { x: 0, y: 0 }, empty),
  );
  const inserted = Either.getOrThrow(insertFragment(empty, diagram, remapped));
  expect(inserted.assumptions).toEqual([
    expect.objectContaining({
      id: 'pasted:assumption-managed-db',
      appliesToModel: false,
    }),
  ]);
  expect(fragmentRecordCounts(empty, remapped)).toEqual({
    linked: 0,
    cloned: 2,
  });
});
