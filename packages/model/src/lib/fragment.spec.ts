import { Either } from 'effect';
import {
  assumptionOf,
  boxAt,
  diagramId,
  elementId,
  flowIn,
  mitigationOf,
  modelWith,
  parsedFixture,
  securityModelFixture,
  threatId,
  threatOf,
  validModel,
} from '../fixtures.js';
import { removeElement } from './element-operations.js';
import {
  seededModel,
  unnamedWithLoopedFlow,
  validModelFixture,
} from './model.fixtures.js';
import {
  fragmentHeldThreats,
  fragmentRecordCounts,
  insertFragment,
  remapFragment,
  selectionFragment,
} from './fragment.js';
import { unlinkMitigation } from './mitigation-operations.js';
import {
  noisyDiagram,
  noisyModel,
  noisyProcess,
} from './operations.fixtures.js';
import { parseModel, type Model } from './parse.js';
import { removeThreat, replaceThreat } from './threat-operations.js';
import type { Threat } from './threats.js';

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

function withRecords(
  records: Pick<typeof validModelFixture, 'mitigations' | 'assumptions'>,
): Model {
  return parsedFixture({ ...validModelFixture, ...records });
}

const [mitigation] = validModelFixture.mitigations;
const [assumption] = validModelFixture.assumptions;

const apiFragment = () =>
  Either.getOrThrow(
    selectionFragment(validModel, diagram, [elementId('element-api')]),
  );

describe('selectionFragment', () => {
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

  it('copies a threat without the model link its source holds', () => {
    const modelWide = parsedFixture({
      ...validModelFixture,
      threats: validModelFixture.threats.map((threat) => ({
        ...threat,
        appliesToModel: true,
      })),
    });
    const fragment = Either.getOrThrow(
      selectionFragment(modelWide, diagram, [elementId('element-api')]),
    );
    expect(fragment.threats).toEqual(apiFragment().threats);
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

describe('remapFragment and insertFragment', () => {
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

  it.each([
    [undefined, { x: 123.63636363636364 + 24, y: 5.1 + 24 }],
    [3, { x: 147.636, y: 29.1 }],
    [1, { x: 147.6, y: 29.1 }],
  ])(
    'stores the geometry it offsets at %s decimals, and leaves a copied size as it was',
    (decimals, position) => {
      const copied = Either.getOrThrow(
        selectionFragment(noisyModel, noisyDiagram, [noisyProcess]),
      );

      const remapped = Either.getOrThrow(
        remapFragment(copied, 'copy', { x: 24, y: 24 }, noisyModel, decimals),
      );

      expect(remapped.diagrams[0].elements[0]).toMatchObject({
        position,
        size: { width: 120.123456, height: 0.04 },
      });
    },
  );

  it('issues a new number past the last issued to each pasted threat whose number the model holds', () => {
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

  it('pastes a threat with no model link, whatever the fragment states', () => {
    const fragment = apiFragment();
    const crafted = parsedFixture({
      ...fragment,
      threats: fragment.threats.map((threat) => ({
        ...threat,
        appliesToModel: true,
      })),
    });
    const remapped = Either.getOrThrow(
      remapFragment(crafted, 'pasted', { x: 0, y: 0 }, validModel),
    );
    const inserted = Either.getOrThrow(
      insertFragment(validModel, diagram, remapped),
    );
    expect(
      inserted.threats.map(({ appliesToModel }) => appliesToModel),
    ).toEqual([false, false]);
  });

  it('pastes an unnamed element and a flow on one boundary at both ends, which only an edit refuses', () => {
    const source = Either.getOrThrow(seededModel(unnamedWithLoopedFlow));
    const fragment = Either.getOrThrow(
      selectionFragment(
        source,
        diagram,
        source.diagrams[0].elements.map((element) => element.id),
      ),
    );
    const remapped = Either.getOrThrow(
      remapFragment(fragment, 'pasted', { x: 0, y: 0 }, validModel),
    );
    expect(Either.isRight(insertFragment(validModel, diagram, remapped))).toBe(
      true,
    );
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
      inserted.diagrams[0].elements.slice(
        0,
        secured.diagrams[0].elements.length,
      ),
    ).toStrictEqual(secured.diagrams[0].elements);
  });
});

describe('pasted threat numbers', () => {
  const drawn = diagramId('d');
  const cutElement = elementId('el-a');
  const source = modelWith({
    elements: [boxAt('el-a', 0, 0), boxAt('el-b', 200, 0)],
    threats: [
      threatOf({ number: 1, elements: ['el-a'] }),
      threatOf({ number: 2, elements: ['el-b'] }),
      threatOf({ number: 3, elements: ['el-a'] }),
    ],
  });
  const cut = Either.getOrThrow(removeElement(source, cutElement));

  function remapped(target: Model, prefix: string, from = source): Model {
    const fragment = Either.getOrThrow(
      selectionFragment(from, drawn, [cutElement]),
    );
    return Either.getOrThrow(
      remapFragment(fragment, prefix, { x: 20, y: 20 }, target),
    );
  }

  function pastedInto(target: Model, fragment: Model) {
    const inserted = Either.getOrThrow(insertFragment(target, drawn, fragment));
    expect(Either.isRight(parseModel(inserted))).toBe(true);
    return {
      numbers: inserted.threats
        .slice(target.threats.length)
        .map(({ number }) => number),
      inserted,
    };
  }

  it('keeps the number of a pasted threat no threat in the model holds', () => {
    const { numbers, inserted } = pastedInto(cut, remapped(cut, 'restored'));
    expect(numbers).toEqual([1, 3]);
    expect(inserted.lastIssuedThreatNumber).toBe(3);
  });

  it('issues a new number past the last issued where the model holds a pasted number', () => {
    const copied = pastedInto(source, remapped(source, 'copied'));
    expect(copied.numbers).toEqual([4, 5]);
    expect(copied.inserted.lastIssuedThreatNumber).toBe(5);
    const partlyHeld = Either.getOrThrow(
      removeThreat(source, threatId('threat-1')),
    );
    const mixed = pastedInto(partlyHeld, remapped(partlyHeld, 'mixed'));
    expect(mixed.numbers).toEqual([1, 4]);
    expect(mixed.inserted.lastIssuedThreatNumber).toBe(4);
  });

  it('keeps a free number on the first paste of a selection, and issues a new one on the second', () => {
    const once = pastedInto(cut, remapped(cut, 'once')).inserted;
    const twice = pastedInto(once, remapped(once, 'twice'));
    expect(twice.numbers).toEqual([4, 5]);
    expect(twice.inserted.lastIssuedThreatNumber).toBe(5);
  });

  it('raises the last issued number to a kept number above it, and issues new numbers past both', () => {
    const target = modelWith({
      elements: [boxAt('el-a', 0, 0)],
      threats: [threatOf({ number: 1, elements: ['el-a'] })],
    });
    const from = modelWith({
      elements: [boxAt('el-a', 0, 0)],
      threats: [
        threatOf({ number: 1, elements: ['el-a'] }),
        threatOf({ number: 7, elements: ['el-a'] }),
      ],
    });
    const { numbers, inserted } = pastedInto(
      target,
      remapped(target, 'ahead', from),
    );
    expect(numbers).toEqual([8, 7]);
    expect(inserted.lastIssuedThreatNumber).toBe(8);
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
      const edited = withRecords({
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
      withRecords({ mitigations: [], assumptions: [] }),
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
    const modelWide = withRecords({
      mitigations: [],
      assumptions: [{ ...assumption, appliesToModel: true }],
    });
    const linked = pasted(modelWide, modelWide);
    expect(linked.inserted.assumptions).toEqual([
      { ...modelWide.assumptions[0], threats: [tamper, linked.threat] },
    ]);
    const cloned = pasted(
      modelWide,
      withRecords({ mitigations: [], assumptions: [] }),
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
    const modelWide = withRecords({
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
    const modelWide = withRecords({
      mitigations: validModelFixture.mitigations,
      assumptions: [{ ...assumption, threats: [], appliesToModel: true }],
    });
    const empty = withRecords({ mitigations: [], assumptions: [] });
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
    const edited = withRecords({
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
    const empty = withRecords({ mitigations: [], assumptions: [] });
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

function holding(methodologyName: string): Model {
  const custom = threatOf({
    number: 1,
    elements: ['el-a'],
    appliesToModel: true,
    category: {
      methodology: 'custom',
      methodologyName,
      category: 'process gap',
    },
  });
  return modelWith({ elements: [boxAt('el-a', 0, 0)], threats: [custom] });
}

describe('pasting a threat that applies to the model', () => {
  const drawn = diagramId('d');
  const copied = elementId('el-a');
  const modelWide = threatOf({
    number: 1,
    elements: ['el-a'],
    appliesToModel: true,
  });
  const ordinary = threatOf({ number: 2, elements: ['el-a'] });
  const shared = mitigationOf({
    id: 'mitigation-shared',
    threats: [modelWide.id, ordinary.id],
  });
  const rested = assumptionOf({
    id: 'assumption-rested',
    threats: [modelWide.id],
  });
  const source = modelWith({
    elements: [boxAt('el-a', 0, 0), boxAt('el-b', 200, 0)],
    threats: [modelWide, ordinary],
    mitigations: [shared],
    assumptions: [rested],
  });
  const cut = Either.getOrThrow(removeElement(source, copied));

  function pastedInto(target: Model, from = source) {
    const fragment = Either.getOrThrow(
      selectionFragment(from, drawn, [copied]),
    );
    const remapped = Either.getOrThrow(
      remapFragment(fragment, 'pasted', { x: 20, y: 20 }, target),
    );
    return {
      inserted: Either.getOrThrow(insertFragment(target, drawn, remapped)),
      records: fragmentRecordCounts(target, remapped),
      held: fragmentHeldThreats(target, remapped).map(({ id }) => id),
    };
  }

  const edited = (change: Partial<Threat>): Model =>
    Either.getOrThrow(replaceThreat(source, { ...modelWide, ...change }));

  it('attaches the pasted element to the threat a cut left in the model, under its number, and copies none', () => {
    expect(cut.threats).toEqual([{ ...modelWide, elements: [] }]);

    const { inserted, held } = pastedInto(cut);

    expect(inserted.threats).toEqual([
      { ...modelWide, elements: ['pasted:el-a'] },
      { ...ordinary, id: 'pasted:threat-2', elements: ['pasted:el-a'] },
    ]);
    expect(inserted.lastIssuedThreatNumber).toBe(2);
    expect(held).toEqual([modelWide.id]);
  });

  it('attaches a copy of the element to the same threat while the original stays on it', () => {
    const { inserted } = pastedInto(source);

    expect(inserted.threats).toEqual([
      { ...modelWide, elements: ['el-a', 'pasted:el-a'] },
      ordinary,
      {
        ...ordinary,
        id: 'pasted:threat-2',
        number: 3,
        elements: ['pasted:el-a'],
      },
    ]);
  });

  it('leaves the records of the held threat as the model holds them, and links a shared record to the pasted threats alone', () => {
    const { inserted, records } = pastedInto(source);

    expect(inserted.mitigations).toEqual([
      { ...shared, threats: [...shared.threats, 'pasted:threat-2'] },
    ]);
    expect(inserted.assumptions).toEqual([rested]);
    expect(records).toEqual({ linked: 1, cloned: 0 });

    const relinked = modelWith({
      elements: [boxAt('el-a', 0, 0)],
      threats: [modelWide],
      mitigations: [{ ...shared, title: 'Edited', threats: [modelWide.id] }],
      assumptions: [{ ...rested, prose: 'Edited.' }],
    });
    const onto = pastedInto(relinked);

    expect(onto.inserted.mitigations).toEqual([
      ...relinked.mitigations,
      {
        ...shared,
        id: 'pasted:mitigation-shared',
        threats: ['pasted:threat-2'],
      },
    ]);
    expect(onto.inserted.assumptions).toEqual(relinked.assumptions);
    expect(onto.records).toEqual({ linked: 0, cloned: 1 });
  });

  it.each<[string, Partial<Threat>]>([
    ['title', { title: 'Edited' }],
    ['description', { description: 'Edited.' }],
    ['severity', { severity: 'critical' }],
    ['status', { status: 'mitigated' }],
    ['category', { category: { methodology: 'STRIDE', category: 'spoofing' } }],
    ['model link', { appliesToModel: false }],
  ])(
    'copies the threat as a new one where the %s of the held threat differs',
    (_, change) => {
      const target = edited(change);
      const { inserted, held } = pastedInto(target);

      expect(inserted.threats.map(({ id, number }) => [id, number])).toEqual([
        [modelWide.id, 1],
        [ordinary.id, 2],
        ['pasted:threat-1', 3],
        ['pasted:threat-2', 4],
      ]);
      expect(inserted.threats[0]).toEqual(target.threats[0]);
      expect(inserted.threats[2].appliesToModel).toBe(false);
      expect(held).toEqual([]);
    },
  );

  it('copies a threat under a custom category where the held threat names another methodology, and attaches to one that names the same', () => {
    const from = holding('House');

    expect(pastedInto(from, from).held).toEqual(['threat-1']);

    const { inserted, held } = pastedInto(holding('Other house'), from);

    expect(held).toEqual([]);
    expect(inserted.threats.map(({ id }) => id)).toEqual([
      'threat-1',
      'pasted:threat-1',
    ]);
  });

  it('copies the threat where the model holds its id under another number', () => {
    const renumbered = modelWith({
      elements: [boxAt('el-a', 0, 0)],
      threats: [{ ...modelWide, number: 5 }],
    });

    const { inserted } = pastedInto(renumbered);

    expect(inserted.threats.map(({ id, number }) => [id, number])).toEqual([
      [modelWide.id, 5],
      ['pasted:threat-1', 1],
      ['pasted:threat-2', 2],
    ]);
  });
});
