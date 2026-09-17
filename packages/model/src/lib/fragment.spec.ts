import { Either } from 'effect';
import {
  diagramId,
  elementId,
  flowIn,
  parsedFixture,
  securityModelFixture,
  validModel,
} from '../fixtures.js';
import { validModelFixture } from './model.fixtures.js';
import {
  fragmentRecordCounts,
  insertFragment,
  remapFragment,
  selectionFragment,
} from './fragment.js';
import { unlinkMitigation } from './mitigation-operations.js';
import { parseModel, type Model } from './parse.js';

const diagram = diagramId('diagram-main');

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

describe('selectionFragment', () => {
  const apiFragment = () =>
    Either.getOrThrow(
      selectionFragment(validModel, diagram, [elementId('element-api')]),
    );

  it('copies each threat, mitigation and assumption the selection links once', () => {
    const fragment = apiFragment();
    expect(fragment.diagrams[0].elements.map((element) => element.id)).toEqual([
      'element-api',
    ]);
    expect(fragment.threats.map(({ id }) => id)).toEqual([
      'threat-tamper-order',
    ]);
    expect(fragment.mitigations.map(({ id }) => id)).toEqual([
      'mitigation-tls',
    ]);
    expect(fragment.assumptions.map(({ id }) => id)).toEqual([
      'assumption-managed-db',
    ]);
    expect(Either.isRight(parseModel(fragment))).toBe(true);
  });

  it('excludes the links a copied threat holds to elements outside the selection', () => {
    expect(apiFragment().threats[0].elements).toEqual(['element-api']);
  });

  it('does not change the source model', () => {
    const before = structuredClone(validModel);
    apiFragment();
    expect(validModel).toEqual(before);
  });

  it('copies an assumption only through a copied threat that links it', () => {
    const unthreatened = Either.getOrThrow(
      selectionFragment(validModel, diagram, [elementId('element-db')]),
    );
    expect(unthreatened.threats).toEqual([]);
    expect(unthreatened.assumptions).toEqual([]);
    const threatened = Either.getOrThrow(
      selectionFragment(validModel, diagram, [elementId('element-api')]),
    );
    expect(threatened.assumptions).toEqual(validModel.assumptions);
  });

  it('copies an assumption without the model link its source holds', () => {
    const modelWide = parsedFixture({
      ...validModelFixture,
      assumptions: validModelFixture.assumptions.map((record) => ({
        ...record,
        appliesToModel: true,
      })),
    });
    const fragment = Either.getOrThrow(
      selectionFragment(modelWide, diagram, [elementId('element-api')]),
    );
    expect(fragment.assumptions).toEqual(validModel.assumptions);
  });

  it('includes the endpoint of a selected flow and keeps its free endpoint', () => {
    const flow = flowIn(validModel, 'element-order-flow');
    const fragment = Either.getOrThrow(
      selectionFragment(validModel, diagram, [flow.id]),
    );
    expect(fragment.diagrams[0].elements).toContainEqual(flow);
    expect(fragment.diagrams[0].elements.map((element) => element.id)).toEqual(
      expect.arrayContaining(['element-order-flow', 'element-customer']),
    );
    expect(Either.isRight(parseModel(fragment))).toBe(true);
  });

  it('includes a flow that runs between two selected nodes', () => {
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
    expect(
      fragment.diagrams[0].elements.map((element) => element.id),
    ).toContain('element-order-flow');
  });

  it('refuses a missing diagram and a missing element', () => {
    expect(
      Either.isLeft(selectionFragment(validModel, diagramId('missing'), [])),
    ).toBe(true);
    expect(
      Either.isLeft(
        selectionFragment(validModel, diagram, [elementId('missing')]),
      ),
    ).toBe(true);
  });
});

describe('remapFragment and insertFragment', () => {
  const whole = () => {
    const fragment = Either.getOrThrow(
      selectionFragment(
        validModel,
        diagram,
        validModel.diagrams[0].elements.map((element) => element.id),
      ),
    );
    const fresh = Either.getOrThrow(
      remapFragment(fragment, 'fresh', { x: 20, y: 30 }, validModel),
    );
    const inserted = Either.getOrThrow(
      insertFragment(validModel, diagram, fresh),
    );
    return { fragment, fresh, inserted };
  };

  it('remaps element ids under the prefix and offsets their geometry', () => {
    const { fresh, inserted } = whole();
    expect(
      inserted.diagrams[0].elements
        .slice(validModel.diagrams[0].elements.length)
        .every((element) => element.id.startsWith('fresh:')),
    ).toBe(true);
    expect(fresh.diagrams[0].elements[0]).toMatchObject({
      position: { x: 60, y: 150 },
    });
  });

  it('issues each pasted threat a number after the last issued', () => {
    const { fragment, inserted } = whole();
    expect(
      inserted.threats
        .slice(validModel.threats.length)
        .map((threat) => threat.number),
    ).toEqual(
      fragment.threats.map(
        (_, index) => validModel.lastIssuedThreatNumber + index + 1,
      ),
    );
    expect(Either.isRight(parseModel(inserted))).toBe(true);
  });

  it('rejects a fragment whose ids the model already holds', () => {
    const { fresh, inserted } = whole();
    expect(Either.isLeft(insertFragment(inserted, diagram, fresh))).toBe(true);
  });

  it('refuses a missing diagram, and returns the model itself for an empty fragment', () => {
    const { fragment } = whole();
    expect(
      Either.isLeft(insertFragment(validModel, diagramId('missing'), fragment)),
    ).toBe(true);
    const empty = Either.getOrThrow(selectionFragment(validModel, diagram, []));
    expect(Either.getOrThrow(insertFragment(validModel, diagram, empty))).toBe(
      validModel,
    );
  });
  it('restricts copied lists to selected targets and remaps every retained relationship', () => {
    const secured = parsedFixture(securityModelFixture);
    const partial = Either.getOrThrow(
      selectionFragment(secured, diagram, [
        elementId('element-perimeter'),
        elementId('element-api'),
      ]),
    );
    expect(
      partial.diagrams[0].elements.find(
        (element) => element.kind === 'trust-boundary',
      ),
    ).toMatchObject({ containedElements: ['element-api'], crossingFlows: [] });
    const full = Either.getOrThrow(
      selectionFragment(
        secured,
        diagram,
        secured.diagrams[0].elements.map((element) => element.id),
      ),
    );
    const remapped = Either.getOrThrow(
      remapFragment(full, 'copy', { x: 20, y: 30 }, secured),
    );
    expect(remapped.diagrams[0].elements[3]).toMatchObject({
      trustBoundaryIds: ['copy:element-perimeter'],
    });
    expect(remapped.diagrams[0].elements[4]).toMatchObject({
      containedElements: ['copy:element-api', 'copy:element-db'],
      crossingFlows: ['copy:element-order-flow'],
    });
    const inserted = Either.getOrThrow(
      insertFragment(secured, diagram, remapped),
    );
    expect(Either.isRight(parseModel(inserted))).toBe(true);
    expect(
      inserted.diagrams[0].elements.slice(0, secured.diagrams[0].elements.length),
    ).toStrictEqual(secured.diagrams[0].elements);
  });
});

describe('pasting records', () => {
  it('links a pasted threat to identical records the model holds', () => {
    const { inserted, counts, threat } = pasted(validModel, validModel);
    expect(inserted.mitigations).toEqual([
      { ...validModel.mitigations[0], threats: [tamper, threat] },
    ]);
    expect(inserted.assumptions).toEqual([
      { ...validModel.assumptions[0], threats: [tamper, threat] },
    ]);
    expect(counts).toEqual({ linked: 2, cloned: 0 });
  });

  it.each<[string, Partial<typeof mitigation>]>([
    ['prose', { prose: 'Edited.' }],
    ['status', { status: 'implemented' }],
    ['title', { title: 'Edited' }],
  ])(
    'clones a mitigation whose %s changed between copy and paste',
    (_, edit) => {
      const edited = modelWith({
        mitigations: [{ ...mitigation, ...edit }],
        assumptions: validModelFixture.assumptions,
      });
      const { inserted, counts, threat } = pasted(validModel, edited);
      expect(inserted.mitigations).toEqual([
        edited.mitigations[0],
        {
          ...validModel.mitigations[0],
          id: 'pasted:mitigation-tls',
          threats: [threat],
        },
      ]);
      expect(counts).toEqual({ linked: 1, cloned: 1 });
    },
  );

  it('clones a record the model no longer holds', () => {
    const culled = Either.getOrThrow(
      unlinkMitigation(
        validModel,
        validModel.mitigations[0].id,
        validModel.threats[0].id,
      ),
    );
    expect(culled.mitigations).toEqual([]);
    const { inserted, threat } = pasted(validModel, culled);
    expect(inserted.mitigations).toEqual([
      {
        ...validModel.mitigations[0],
        id: 'pasted:mitigation-tls',
        threats: [threat],
      },
    ]);
  });

  it('links to an identical record another model holds and clones into one without it', () => {
    const other = parsedFixture({
      ...validModelFixture,
      threats: [{ ...validModelFixture.threats[0], id: 'threat-other' }],
      mitigations: [{ ...mitigation, threats: ['threat-other'] }],
      assumptions: [{ ...assumption, threats: ['threat-other'] }],
    });
    const linked = pasted(validModel, other);
    expect(linked.inserted.mitigations).toEqual([
      { ...other.mitigations[0], threats: ['threat-other', linked.threat] },
    ]);
    expect(linked.inserted.assumptions).toEqual([
      { ...other.assumptions[0], threats: ['threat-other', linked.threat] },
    ]);
    const cloned = pasted(
      validModel,
      modelWith({ mitigations: [], assumptions: [] }),
    );
    expect(cloned.inserted.mitigations).toEqual([
      {
        ...validModel.mitigations[0],
        id: 'pasted:mitigation-tls',
        threats: [cloned.threat],
      },
    ]);
    expect(cloned.inserted.assumptions).toEqual([
      {
        ...validModel.assumptions[0],
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
    const { inserted, counts, threat } = pasted(validModel, modelWide);
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
      selectionFragment(validModel, diagram, [elementId('element-api')]),
    );
    const remapped = Either.getOrThrow(
      remapFragment(fragment, 'pasted', { x: 0, y: 0 }, validModel),
    );
    const edited = modelWith({
      mitigations: [{ ...mitigation, prose: 'Edited.' }],
      assumptions: validModelFixture.assumptions,
    });
    expect(Either.isLeft(insertFragment(edited, diagram, remapped))).toBe(true);
  });

  it('pastes no model link and no record that links no pasted threat', () => {
    const fragment = Either.getOrThrow(
      selectionFragment(validModel, diagram, [elementId('element-api')]),
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
    const inserted = Either.getOrThrow(
      insertFragment(empty, diagram, remapped),
    );
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
});
