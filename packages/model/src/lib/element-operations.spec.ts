import { Either } from 'effect';
import * as fc from 'fast-check';
import {
  boxAt,
  diagramId,
  elementId,
  elementIn,
  flowIn,
  modelInputArbitrary,
  modelWith,
  parsedFixture,
  securityModelFixture,
  softHyphen,
  validModel,
} from '../fixtures.js';
import { decimalsOf } from './decimals.js';
import { addDiagram } from './diagram-operations.js';
import {
  addElement,
  editNote,
  moveElement,
  removeElement,
  renameElement,
  resizeElement,
  setAccent,
  setElementDetails,
} from './element-operations.js';
import { elementSchema, type Element } from './elements.js';
import { seededModel, validModelFixture } from './model.fixtures.js';
import { OperationFailure } from './operation-failures.js';
import {
  cache,
  elementIds,
  errorOf,
  flowInput,
  mainDiagram,
  modelOf,
  noisyBox,
  noisyCurve,
  noisyDiagram,
  noisyFlow,
  noisyModel,
  noisyProcess,
  noisyStore,
  note,
  operationContract,
  pointsOf,
  storeInput,
  withNote,
  writeFlow,
} from './operations.fixtures.js';
import { parseModel, type Model } from './parse.js';
import { elementsAcross } from './references.js';

const secured = parsedFixture(securityModelFixture);

const blankNames = ['', ' \t\n'];

const everyKindButFlow: readonly Element[] = [
  elementIn(validModel, 'element-customer'),
  elementIn(validModel, 'element-api'),
  elementIn(validModel, 'element-db'),
  elementIn(validModel, 'element-perimeter'),
  note,
];

const movedAtOneDecimal = (id: string): Element =>
  elementIn(
    modelOf(moveElement(noisyModel, elementId(id), { x: 5, y: 20 }, 1)),
    id,
  );

const readWith = (...added: readonly Element[]): Model =>
  Either.getOrThrow(
    seededModel((draft) => {
      draft.diagrams[0].elements.push(...added);
    }),
  );

describe('addElement', () => {
  it('adds a node to the named diagram', () => {
    const next = modelOf(addElement(validModel, mainDiagram, cache));
    expect(elementIds(next)).toContain('element-cache');
  });

  it('adds a flow anchored to elements of the target diagram', () => {
    const next = modelOf(addElement(validModel, mainDiagram, writeFlow));
    expect(flowIn(next, 'element-write-flow').source).toEqual({
      kind: 'attached',
      element: 'element-api',
    });
  });

  it('leaves diagrams other than the target untouched', () => {
    const draft = structuredClone(validModelFixture);
    draft.diagrams.push({ id: 'diagram-annex', title: 'Annex', elements: [] });
    const next = modelOf(addElement(parsedFixture(draft), mainDiagram, cache));
    expect(next.diagrams[1]).toEqual({
      id: 'diagram-annex',
      title: 'Annex',
      elements: [],
    });
    expect(elementIds(next)).toContain('element-cache');
  });

  it('adds a trust boundary', () => {
    const zone = elementSchema.parse({
      kind: 'trust-boundary',
      id: 'element-dmz',
      name: 'DMZ',
      description: '',
      outOfScope: false,
      reasonOutOfScope: '',
      shape: {
        kind: 'box',
        position: { x: 20, y: 400 },
        size: { width: 300, height: 140 },
      },
    });
    const next = modelOf(addElement(validModel, mainDiagram, zone));
    expect(elementIn(next, 'element-dmz').kind).toBe('trust-boundary');
  });

  it('fails on an unknown diagram', () => {
    expect(
      errorOf(addElement(validModel, diagramId('diagram-ghost'), cache)),
    ).toEqual(
      OperationFailure.UnknownDiagram({
        diagramId: diagramId('diagram-ghost'),
      }),
    );
  });

  it('fails on a duplicate element id', () => {
    const clash = elementSchema.parse({ ...storeInput, id: 'element-api' });
    expect(errorOf(addElement(validModel, mainDiagram, clash))).toEqual(
      OperationFailure.DuplicateElementId({
        elementId: elementId('element-api'),
      }),
    );
  });

  it('fails on a flow endpoint anchored outside the diagram', () => {
    const dangling = elementSchema.parse({
      ...flowInput,
      id: 'element-dangling-flow',
      target: { kind: 'attached', element: 'element-ghost' },
    });
    expect(errorOf(addElement(validModel, mainDiagram, dangling))).toEqual(
      OperationFailure.InvalidFlowEndpoint({
        side: 'target',
        reference: elementId('element-ghost'),
      }),
    );
  });

  it('fails on a flow anchored to itself', () => {
    const selfAnchored = elementSchema.parse({
      ...flowInput,
      id: 'element-loop-flow',
      source: { kind: 'attached', element: 'element-loop-flow' },
    });
    expect(errorOf(addElement(validModel, mainDiagram, selfAnchored))).toEqual(
      OperationFailure.InvalidFlowEndpoint({
        side: 'source',
        reference: elementId('element-loop-flow'),
      }),
    );
  });

  it.each([
    ['a canvas note', withNote, 'element-note'],
    ['a trust boundary', validModel, 'element-perimeter'],
    ['another flow', validModel, 'element-order-flow'],
  ] as const)(
    'refuses a flow ending on %s, as reconnectFlow does',
    (_, model, target) => {
      const flow = elementSchema.parse({
        ...flowInput,
        target: { kind: 'attached', element: target },
      });
      expect(errorOf(addElement(model, mainDiagram, flow))).toEqual(
        OperationFailure.InvalidFlowEndpoint({
          side: 'target',
          reference: elementId(target),
        }),
      );
    },
  );

  it('refuses a flow whose two ends attach to one element, naming its source', () => {
    const loop = elementSchema.parse({
      ...flowInput,
      target: flowInput.source,
    });
    expect(errorOf(addElement(validModel, mainDiagram, loop))).toEqual(
      OperationFailure.InvalidFlowEndpoint({
        side: 'source',
        reference: elementId('element-api'),
      }),
    );
  });

  it.each(
    everyKindButFlow.flatMap((element) =>
      blankNames.map((name) => [element.kind, name, element] as const),
    ),
  )('refuses a %s named %j, as renameElement does', (_, name, element) => {
    const unnamed = { ...element, id: elementId('element-unnamed'), name };
    expect(errorOf(addElement(validModel, mainDiagram, unnamed))).toEqual(
      OperationFailure.EmptyName({ elementId: unnamed.id }),
    );
  });

  it.each(blankNames)('adds a flow named %j unlabelled', (name) => {
    const next = modelOf(
      addElement(validModel, mainDiagram, { ...writeFlow, name }),
    );
    expect(flowIn(next, 'element-write-flow').name).toBe('');
  });

  it('stores the whole geometry of the element it adds at the decimals named, and the element itself where none is', () => {
    const holder = modelWith({
      elements: [boxAt(noisyStore, 300.0004, 0.04, 'store')],
    });
    const added = (id: string, decimals?: number) =>
      elementIn(
        modelOf(
          addElement(holder, noisyDiagram, elementIn(noisyModel, id), decimals),
        ),
        id,
      );

    for (const id of [noisyProcess, noisyFlow, noisyBox, noisyCurve]) {
      expect(added(id)).toBe(elementIn(noisyModel, id));
    }
    expect(added(noisyProcess, 1)).toMatchObject({
      position: { x: 123.6, y: 5.1 },
      size: { width: 120.1, height: 60 },
    });
    expect(added(noisyFlow, 1)).toMatchObject({
      source: { kind: 'attached', element: noisyStore },
      target: { position: { x: 500.6, y: 200.4 } },
      waypoints: [{ x: 250.1, y: 100 }],
    });
    expect(added(noisyBox, 3)).toMatchObject({
      shape: {
        position: { x: 10.123, y: -20.988 },
        size: { width: 400.556, height: 300.444 },
      },
    });
    expect(added(noisyCurve, 1)).toMatchObject({
      shape: {
        waypoints: [
          { x: -20.3, y: 80.7 },
          { x: 200.1, y: -20.2 },
          { x: 441, y: 80.6 },
        ],
      },
    });
  });

  it('refuses cross-diagram references and checks new elements and diagrams', () => {
    const boundary = secured.diagrams[0].elements[4];
    const outside = parsedFixture({
      ...secured,
      threats: [],
      mitigations: [],
      assumptions: [],
      diagrams: [
        {
          ...secured.diagrams[0],
          elements: secured.diagrams[0].elements.slice(0, 3),
        },
        { id: 'other', title: 'Other', elements: [] },
      ],
    });
    expect(
      Either.isLeft(addElement(outside, diagramId('other'), boundary)),
    ).toBe(true);
    expect(
      Either.isLeft(
        addDiagram(outside, {
          id: diagramId('new'),
          title: 'New',
          elements: [boundary],
        }),
      ),
    ).toBe(true);
    const invalid = {
      ...outside,
      diagrams: [
        ...outside.diagrams,
        { id: 'third', title: 'Third', elements: [boundary] },
      ],
    };
    expect(Either.isLeft(parseModel(invalid))).toBe(true);
  });
});

describe('removeElement', () => {
  it('removes the element from its diagram', () => {
    const next = modelOf(removeElement(validModel, elementId('element-db')));
    expect(elementIds(next)).not.toContain('element-db');
  });

  it('frees the endpoints of flows anchored to the removed element', () => {
    const next = modelOf(
      removeElement(validModel, elementId('element-customer')),
    );
    expect(flowIn(next, 'element-order-flow').source).toEqual({
      kind: 'free',
      position: { x: 120, y: 160 },
    });
    expect(Either.isRight(parseModel(next))).toBe(true);
  });

  it('detaches the removed element from threat links', () => {
    const next = modelOf(removeElement(validModel, elementId('element-api')));
    expect(next.threats).toHaveLength(1);
    expect(next.threats[0].elements).toEqual(['element-order-flow']);
  });

  it('leaves every assumption record unchanged', () => {
    const next = modelOf(removeElement(validModel, elementId('element-db')));
    expect(next.assumptions).toEqual(validModel.assumptions);
  });

  it('removes a threat the deleted element was the last attachment of', () => {
    const next = ['element-api', 'element-order-flow'].reduce(
      (model, id) => modelOf(removeElement(model, elementId(id))),
      validModel,
    );
    expect(next.threats).toEqual([]);
    expect(next.mitigations).toEqual([]);
    expect(next.assumptions).toEqual([]);
    expect(next.lastIssuedThreatNumber).toBe(validModel.lastIssuedThreatNumber);
  });

  it('removes it whichever of its elements the fold deletes last', () => {
    const next = ['element-order-flow', 'element-api'].reduce(
      (model, id) => modelOf(removeElement(model, elementId(id))),
      validModel,
    );
    expect(next.threats).toEqual([]);
  });

  it('keeps a threat that applies to the model when the deleted element was its last', () => {
    const draft = structuredClone(validModelFixture);
    draft.threats[0].appliesToModel = true;
    const modelWide = parsedFixture(draft);
    const next = ['element-api', 'element-order-flow'].reduce(
      (model, id) => modelOf(removeElement(model, elementId(id))),
      modelWide,
    );
    expect(next.threats).toEqual([{ ...modelWide.threats[0], elements: [] }]);
    expect(next.mitigations).toEqual(modelWide.mitigations);
    expect(next.assumptions).toEqual(modelWide.assumptions);
  });

  it('keeps a threat that was already attached to no element', () => {
    const draft = structuredClone(validModelFixture);
    draft.threats[0].elements = [];
    const unattached = parsedFixture(draft);
    const next = modelOf(removeElement(unattached, elementId('element-api')));
    expect(next.threats).toEqual(unattached.threats);
    expect(next.mitigations).toEqual(unattached.mitigations);
  });

  it('removes a flow and detaches its threat links', () => {
    const next = modelOf(
      removeElement(validModel, elementId('element-order-flow')),
    );
    expect(elementIds(next)).not.toContain('element-order-flow');
    expect(next.threats[0].elements).toEqual(['element-api']);
  });

  it('removes a trust boundary of either shape', () => {
    const box = modelOf(
      removeElement(validModel, elementId('element-perimeter')),
    );
    expect(elementIds(box)).not.toContain('element-perimeter');
    const curve = modelOf(
      removeElement(validModel, elementId('element-billing-zone')),
    );
    expect(elementIds(curve)).not.toContain('element-billing-zone');
  });

  it('removes only references to the explicitly deleted element, keeping absence distinct from empty', () => {
    const withoutStore = modelOf(
      removeElement(secured, elementId('element-db')),
    );
    expect(elementIn(withoutStore, 'element-perimeter')).toMatchObject({
      containedElements: ['element-api'],
      crossingFlows: ['element-order-flow'],
    });
    const withoutFlow = modelOf(
      removeElement(withoutStore, elementId('element-order-flow')),
    );
    expect(elementIn(withoutFlow, 'element-perimeter')).toMatchObject({
      containedElements: ['element-api'],
      crossingFlows: [],
    });
    const withoutBoundary = modelOf(
      removeElement(secured, elementId('element-perimeter')),
    );
    expect(flowIn(withoutBoundary, 'element-order-flow')).toMatchObject({
      trustBoundaryIds: [],
    });
    expect(Either.isRight(parseModel(withoutBoundary))).toBe(true);
    const legacy = modelOf(
      removeElement(validModel, elementId('element-perimeter')),
    );
    expect(legacy.diagrams[0].elements).toStrictEqual(
      validModel.diagrams[0].elements.filter(
        (element) => element.id !== 'element-perimeter',
      ),
    );
  });

  it.each([
    [undefined, { x: 300.0004 + 60, y: 0.04 + 40 }],
    [1, { x: 360, y: 40 }],
  ])(
    'frees an endpoint at the anchor it works out, stored at %s decimals',
    (decimals, position) => {
      const next = modelOf(removeElement(noisyModel, noisyStore, decimals));

      expect(flowIn(next, noisyFlow).source).toEqual({
        kind: 'free',
        position,
      });
    },
  );

  it("frees an endpoint at the removed flow's own free endpoint", () => {
    const spur = elementSchema.parse({
      ...flowInput,
      id: 'element-spur-flow',
      source: { kind: 'free', position: { x: 500, y: 500 } },
      target: { kind: 'attached', element: 'element-db' },
    });
    const tap = elementSchema.parse({
      ...flowInput,
      id: 'element-tap-flow',
      source: { kind: 'attached', element: 'element-spur-flow' },
      target: { kind: 'free', position: { x: 640, y: 480 } },
    });
    const next = modelOf(
      removeElement(readWith(spur, tap), elementId('element-spur-flow')),
    );
    expect(flowIn(next, 'element-tap-flow').source).toEqual({
      kind: 'free',
      position: { x: 500, y: 500 },
    });
  });

  it('frees an endpoint at the canvas origin when the removed flow has no point of its own', () => {
    const meter = elementSchema.parse({
      ...flowInput,
      id: 'element-meter-flow',
      source: { kind: 'attached', element: 'element-write-flow' },
      target: { kind: 'free', position: { x: 700, y: 300 } },
    });
    const next = modelOf(
      removeElement(
        readWith(writeFlow, meter),
        elementId('element-write-flow'),
      ),
    );
    expect(flowIn(next, 'element-meter-flow').source).toEqual({
      kind: 'free',
      position: { x: 0, y: 0 },
    });
    expect(Either.isRight(parseModel(next))).toBe(true);
  });

  it('fails on an unknown element', () => {
    expect(
      errorOf(removeElement(validModel, elementId('element-ghost'))),
    ).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('moveElement', () => {
  it('moves a node by the offset', () => {
    const next = modelOf(
      moveElement(validModel, elementId('element-customer'), { x: 30, y: -20 }),
    );
    expect(elementIn(next, 'element-customer')).toMatchObject({
      position: { x: 70, y: 100 },
    });
  });

  it('moves the waypoints and free endpoints of a flow, not its anchors', () => {
    const next = modelOf(
      moveElement(validModel, elementId('element-order-flow'), { x: 10, y: 5 }),
    );
    expect(flowIn(next, 'element-order-flow')).toMatchObject({
      source: { kind: 'attached', element: 'element-customer' },
      target: { kind: 'free', position: { x: 290, y: 165 } },
      waypoints: [{ x: 210, y: 145 }],
    });
  });

  it('moves a trust boundary in either shape', () => {
    const box = modelOf(
      moveElement(validModel, elementId('element-perimeter'), {
        x: -10,
        y: 10,
      }),
    );
    expect(elementIn(box, 'element-perimeter')).toMatchObject({
      shape: { kind: 'box', position: { x: 270, y: 70 } },
    });
    const curve = modelOf(
      moveElement(validModel, elementId('element-billing-zone'), {
        x: 5,
        y: 5,
      }),
    );
    expect(elementIn(curve, 'element-billing-zone')).toMatchObject({
      shape: {
        kind: 'curve',
        waypoints: [
          { x: 45, y: 325 },
          { x: 405, y: 305 },
          { x: 765, y: 345 },
        ],
      },
    });
  });

  it.each([
    [undefined, { x: 123.63636363636364 + 5, y: 5.1 - 5 }],
    [3, { x: 128.636, y: 0.1 }],
    [1, { x: 128.6, y: 0.1 }],
    [0, { x: 129, y: 0 }],
  ])(
    'lands a move from a noisy position on a number of %s decimals, where one is named',
    (decimals, position) => {
      const next = modelOf(
        moveElement(noisyModel, noisyProcess, { x: 5, y: -5 }, decimals),
      );

      expect(elementIn(next, noisyProcess)).toMatchObject({ position });
    },
  );

  it('stores the bends, free ends and curve points it carries at the decimals named, and a box boundary by its position', () => {
    expect(movedAtOneDecimal(noisyFlow)).toMatchObject({
      source: { kind: 'attached', element: noisyStore },
      target: { position: { x: 505.6, y: 220.4 } },
      waypoints: [{ x: 255.1, y: 120 }],
    });
    expect(movedAtOneDecimal(noisyCurve)).toMatchObject({
      shape: {
        waypoints: [
          { x: -15.3, y: 100.7 },
          { x: 205.1, y: -0.2 },
          { x: 446, y: 100.6 },
        ],
      },
    });
    expect(movedAtOneDecimal(noisyBox)).toMatchObject({
      shape: {
        position: { x: 15.1, y: -1 },
        size: { width: 400.5558, height: 300.4444 },
      },
    });
  });

  it('returns the same model for a move that would store every number as it is', () => {
    const settled = modelOf(
      moveElement(noisyModel, noisyProcess, { x: 5, y: -5 }, 1),
    );
    const attached = modelOf(addElement(validModel, mainDiagram, writeFlow));

    expect(modelOf(moveElement(settled, noisyProcess, { x: 0, y: 0 }))).toBe(
      settled,
    );
    expect(
      modelOf(moveElement(settled, noisyProcess, { x: 1e-12, y: -0.04 }, 1)),
    ).toBe(settled);
    expect(
      modelOf(moveElement(settled, noisyProcess, { x: 1e-12, y: 0 })),
    ).not.toBe(settled);
    expect(modelOf(moveElement(attached, writeFlow.id, { x: 5, y: 5 }))).toBe(
      attached,
    );
  });

  it('leaves the size of what it moves, and every other element, as stored', () => {
    const next = modelOf(
      moveElement(noisyModel, noisyProcess, { x: 5, y: -5 }, 1),
    );

    expect(elementIn(next, noisyProcess)).toMatchObject({
      size: { width: 120.123456, height: 60.04 },
    });
    for (const id of [noisyStore, noisyFlow, noisyBox, noisyCurve]) {
      expect(elementIn(next, id)).toBe(elementIn(noisyModel, id));
    }
  });

  it('fails on an unknown element', () => {
    expect(
      errorOf(
        moveElement(validModel, elementId('element-ghost'), { x: 1, y: 1 }),
      ),
    ).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('moveElement over generated models', () => {
  const generatedModel = modelInputArbitrary.map(parsedFixture);
  const coordinate = fc.double({
    min: -500,
    max: 500,
    noNaN: true,
    noDefaultInfinity: true,
  });
  const offsetArbitrary = fc.record({ x: coordinate, y: coordinate });

  it('stores each point it writes at the decimals named, nearest where the offset puts it, the same on every call, and touches no other element', () => {
    fc.assert(
      fc.property(
        generatedModel,
        offsetArbitrary,
        fc.constantFrom(0, 1, 3),
        (model, offset, decimals) => {
          for (const element of elementsAcross(model.diagrams)) {
            const moved = modelOf(
              moveElement(model, element.id, offset, decimals),
            );
            const from = pointsOf(element);
            for (const [index, point] of pointsOf(
              elementIn(moved, element.id),
            ).entries()) {
              for (const axis of ['x', 'y'] as const) {
                expect(decimalsOf(point[axis])).toBeLessThanOrEqual(decimals);
                expect(Object.is(point[axis], -0)).toBe(false);
                expect(
                  Math.abs(point[axis] - (from[index][axis] + offset[axis])),
                ).toBeLessThanOrEqual(0.5 / 10 ** decimals + 1e-9);
              }
            }
            for (const other of elementsAcross(model.diagrams).filter(
              (held) => held.id !== element.id,
            )) {
              expect(elementIn(moved, other.id)).toBe(other);
            }
            expect(
              modelOf(moveElement(model, element.id, offset, decimals)),
            ).toEqual(moved);
          }
        },
      ),
    );
  });

  it('stores what the offset computes where no count is named', () => {
    fc.assert(
      fc.property(generatedModel, offsetArbitrary, (model, offset) => {
        for (const element of elementsAcross(model.diagrams)) {
          const moved = modelOf(moveElement(model, element.id, offset));
          expect(pointsOf(elementIn(moved, element.id))).toEqual(
            pointsOf(element).map((point) => ({
              x: point.x + offset.x,
              y: point.y + offset.y,
            })),
          );
        }
      }),
    );
  });
});

describe('resizeElement', () => {
  it('resizes a node', () => {
    const next = modelOf(
      resizeElement(validModel, elementId('element-api'), {
        width: 200,
        height: 100,
      }),
    );
    expect(elementIn(next, 'element-api')).toMatchObject({
      size: { width: 200, height: 100 },
    });
  });

  it('resizes a box trust boundary', () => {
    const next = modelOf(
      resizeElement(validModel, elementId('element-perimeter'), {
        width: 600,
        height: 240,
      }),
    );
    expect(elementIn(next, 'element-perimeter')).toMatchObject({
      shape: { size: { width: 600, height: 240 } },
    });
  });

  it.each([
    [undefined, { width: 125.123456, height: 60.04 }],
    [3, { width: 125.123, height: 60.04 }],
    [1, { width: 125.1, height: 60 }],
    [0, { width: 125, height: 60 }],
  ])(
    'stores a size at %s decimals and leaves the position as stored',
    (decimals, size) => {
      const next = modelOf(
        resizeElement(
          noisyModel,
          noisyProcess,
          { width: 125.123456, height: 60.04 },
          decimals,
        ),
      );

      expect(elementIn(next, noisyProcess)).toMatchObject({
        position: { x: 123.63636363636364, y: 5.1 },
        size,
      });
    },
  );

  it('returns the same model for a resize that would store the size the element has', () => {
    const settled = modelOf(
      resizeElement(noisyModel, noisyProcess, { width: 125.04, height: 60 }, 1),
    );

    expect(
      modelOf(resizeElement(settled, noisyProcess, { width: 125, height: 60 })),
    ).toBe(settled);
    expect(
      modelOf(
        resizeElement(
          settled,
          noisyProcess,
          { width: 125.04, height: 59.96 },
          1,
        ),
      ),
    ).toBe(settled);
    expect(
      modelOf(
        resizeElement(settled, noisyProcess, { width: 125.04, height: 60 }),
      ),
    ).not.toBe(settled);
  });

  it('refuses a flow and a curve trust boundary', () => {
    const size = { width: 10, height: 10 };
    expect(
      errorOf(resizeElement(validModel, elementId('element-order-flow'), size)),
    ).toEqual(
      OperationFailure.NotResizable({
        elementId: elementId('element-order-flow'),
      }),
    );
    expect(
      errorOf(
        resizeElement(validModel, elementId('element-billing-zone'), size),
      ),
    ).toEqual(
      OperationFailure.NotResizable({
        elementId: elementId('element-billing-zone'),
      }),
    );
  });

  it('fails on an unknown element', () => {
    expect(
      errorOf(
        resizeElement(validModel, elementId('element-ghost'), {
          width: 10,
          height: 10,
        }),
      ),
    ).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('renameElement', () => {
  it('renames a node', () => {
    const next = modelOf(
      renameElement(validModel, elementId('element-customer'), 'Buyer'),
    );
    expect(elementIn(next, 'element-customer').name).toBe('Buyer');
  });

  it('renames a flow, which is what the canvas draws as its label', () => {
    const next = modelOf(
      renameElement(validModel, elementId('element-order-flow'), 'Place order'),
    );
    expect(flowIn(next, 'element-order-flow').name).toBe('Place order');
  });

  it.each(
    everyKindButFlow.flatMap((element) =>
      blankNames.map((name) => [element.kind, name, element] as const),
    ),
  )('refuses to name a %s %j', (_, name, element) => {
    expect(errorOf(renameElement(withNote, element.id, name))).toEqual(
      OperationFailure.EmptyName({ elementId: element.id }),
    );
  });

  it.each(blankNames)(
    'leaves a flow renamed %j unlabelled, which draws no label',
    (name) => {
      const next = modelOf(
        renameElement(validModel, elementId('element-order-flow'), name),
      );
      expect(flowIn(next, 'element-order-flow').name).toBe('');
    },
  );

  it('returns the same model for the name the element already holds', () => {
    const unlabelled = modelOf(
      renameElement(validModel, elementId('element-order-flow'), ''),
    );
    expect(
      Either.getOrThrow(
        renameElement(unlabelled, elementId('element-order-flow'), ' \t'),
      ),
    ).toBe(unlabelled);
  });

  it('refuses a character the parse boundary refuses, saying where it sits', () => {
    expect(
      errorOf(
        renameElement(
          validModel,
          elementId('element-api'),
          `Order${softHyphen}API`,
        ),
      ),
    ).toEqual(
      OperationFailure.RefusedCharacter({
        elementId: elementId('element-api'),
        at: 5,
      }),
    );
  });

  it('fails on an unknown element', () => {
    expect(
      errorOf(renameElement(validModel, elementId('element-ghost'), 'Ghost')),
    ).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('editNote', () => {
  it('changes multiline note text, including an empty note', () => {
    const edited = modelOf(
      editNote(withNote, elementId('element-note'), 'First\nSecond'),
    );
    const cleared = modelOf(editNote(edited, elementId('element-note'), ''));
    const element = elementIn(cleared, 'element-note');

    expect(element.kind === 'text' ? element.text : undefined).toBe('');
  });

  it('refuses an element that is not a note', () => {
    expect(
      errorOf(editNote(validModel, elementId('element-api'), 'Not a note')),
    ).toEqual(
      OperationFailure.NotTextElement({
        elementId: elementId('element-api'),
      }),
    );
  });

  it('refuses a character the parse boundary refuses', () => {
    expect(
      errorOf(
        editNote(
          withNote,
          elementId('element-note'),
          `Soft${softHyphen}hyphen`,
        ),
      ),
    ).toEqual(
      OperationFailure.RefusedCharacter({
        elementId: elementId('element-note'),
        at: 4,
      }),
    );
  });
});

describe('setElementDetails', () => {
  const details = {
    description: 'Reworded on review.',
    outOfScope: true,
    reasonOutOfScope: 'Run by another team.',
  };
  const db = elementId('element-db');
  const heldDb = elementIn(validModel, db);

  it.each(withNote.diagrams[0].elements)(
    'changes all three on the $kind $id in place, keeping its other fields',
    (before) => {
      const next = modelOf(setElementDetails(withNote, before.id, details));
      expect(elementIds(next)).toEqual(elementIds(withNote));
      expect(elementIn(next, before.id)).toEqual({ ...before, ...details });
    },
  );

  it('keeps the fields a change leaves out', () => {
    const next = modelOf(
      setElementDetails(validModel, db, { description: 'Holds orders.' }),
    );
    expect(elementIn(next, db)).toEqual({
      ...heldDb,
      description: 'Holds orders.',
    });
  });

  it('keeps the reason when the scope flag is cleared, and the flag when the reason is', () => {
    const cleared = modelOf(
      setElementDetails(validModel, db, { outOfScope: false }),
    );
    const unexplained = modelOf(
      setElementDetails(validModel, db, { reasonOutOfScope: '' }),
    );
    expect(elementIn(cleared, db)).toMatchObject({
      outOfScope: false,
      reasonOutOfScope: heldDb.reasonOutOfScope,
    });
    expect(elementIn(unexplained, db)).toMatchObject({
      outOfScope: true,
      reasonOutOfScope: '',
    });
  });

  it('returns the same model for a change that changes nothing', () => {
    expect(modelOf(setElementDetails(validModel, db, {}))).toBe(validModel);
    expect(
      modelOf(
        setElementDetails(validModel, db, {
          description: heldDb.description,
          outOfScope: heldDb.outOfScope,
          reasonOutOfScope: heldDb.reasonOutOfScope,
        }),
      ),
    ).toBe(validModel);
  });

  it.each(['description', 'reasonOutOfScope'])(
    'refuses a character the parse boundary refuses in the %s, saying where it sits',
    (field) => {
      expect(
        errorOf(
          setElementDetails(validModel, db, {
            [field]: `Soft${softHyphen}hyphen`,
          }),
        ),
      ).toEqual(OperationFailure.RefusedCharacter({ elementId: db, at: 4 }));
    },
  );

  it('points into the description where both texts carry a refused character', () => {
    expect(
      errorOf(
        setElementDetails(validModel, db, {
          description: `Soft${softHyphen}hyphen`,
          reasonOutOfScope: `${softHyphen}Hyphen`,
        }),
      ),
    ).toEqual(OperationFailure.RefusedCharacter({ elementId: db, at: 4 }));
  });

  it('fails on an unknown element', () => {
    expect(
      errorOf(
        setElementDetails(validModel, elementId('element-ghost'), details),
      ),
    ).toEqual(
      OperationFailure.UnknownElement({
        elementId: elementId('element-ghost'),
      }),
    );
  });
});

describe('setAccent', () => {
  const api = elementId('element-api');
  const flow = elementId('element-order-flow');
  const perimeter = elementId('element-perimeter');
  const everyAccentableKind = withNote.diagrams[0].elements
    .filter((element) => element.kind !== 'text')
    .map((element) => element.id);

  it('gives every element named the one key in one model, keeping their other fields and their order', () => {
    const next = modelOf(setAccent(withNote, everyAccentableKind, 's2'));
    expect(elementIds(next)).toEqual(elementIds(withNote));
    expect(next.diagrams[0].elements).toEqual(
      withNote.diagrams[0].elements.map((element) =>
        element.kind === 'text' ? element : { ...element, accent: 's2' },
      ),
    );
  });

  it('clears the accent to an absent key, so a cleared model equals one never accented', () => {
    const accented = modelOf(setAccent(validModel, [api, flow], 'l4'));
    const cleared = modelOf(setAccent(accented, [flow, api], undefined));
    expect(cleared).toEqual(validModel);
    expect(Object.hasOwn(elementIn(cleared, api), 'accent')).toBe(false);
  });

  it('replaces a held accent, and leaves the elements it does not name as they were', () => {
    const accented = modelOf(setAccent(validModel, [api, perimeter], 's1'));
    const next = modelOf(setAccent(accented, [api], 'l3'));
    expect(elementIn(next, api)).toMatchObject({ accent: 'l3' });
    expect(elementIn(next, perimeter)).toBe(elementIn(accented, perimeter));
  });

  it('returns the same model where every element named already holds the key, or none to clear', () => {
    const accented = modelOf(setAccent(validModel, [api], 's1'));
    expect(modelOf(setAccent(accented, [api, api], 's1'))).toBe(accented);
    expect(modelOf(setAccent(validModel, [api, flow], undefined))).toBe(
      validModel,
    );
    expect(modelOf(setAccent(validModel, [], 's1'))).toBe(validModel);
  });

  it('refuses the whole edit over a canvas note, which takes no accent', () => {
    expect(errorOf(setAccent(withNote, [api, note.id], 's1'))).toEqual(
      OperationFailure.NotAccentable({ elementId: note.id }),
    );
  });

  it('fails on an unknown element', () => {
    const ghost = elementId('element-ghost');
    expect(errorOf(setAccent(validModel, [api, ghost], 's1'))).toEqual(
      OperationFailure.UnknownElement({ elementId: ghost }),
    );
  });
});

describe('element operations', () => {
  operationContract({
    addElement: {
      input: validModel,
      run: (model) => addElement(model, mainDiagram, writeFlow),
    },
    'addElement of a node': {
      input: validModel,
      run: (model) => addElement(model, mainDiagram, cache),
    },
    removeElement: {
      input: validModel,
      run: (model) => removeElement(model, elementId('element-customer')),
    },
    moveElement: {
      input: validModel,
      run: (model) =>
        moveElement(model, elementId('element-order-flow'), { x: 10, y: 5 }),
    },
    'moveElement of a box': {
      input: validModel,
      run: (model) =>
        moveElement(model, elementId('element-api'), { x: 1, y: 1 }),
    },
    resizeElement: {
      input: validModel,
      run: (model) =>
        resizeElement(model, elementId('element-api'), {
          width: 200,
          height: 100,
        }),
    },
    'resizeElement to a 5 by 5 box': {
      input: validModel,
      run: (model) =>
        resizeElement(model, elementId('element-api'), {
          width: 5,
          height: 5,
        }),
    },
    'addElement at one decimal': {
      input: noisyModel,
      run: (model) =>
        addElement(
          model,
          noisyDiagram,
          { ...elementIn(noisyModel, noisyProcess), id: elementId('again') },
          1,
        ),
    },
    'removeElement at one decimal': {
      input: noisyModel,
      run: (model) => removeElement(model, noisyStore, 1),
    },
    'moveElement at one decimal': {
      input: noisyModel,
      run: (model) => moveElement(model, noisyFlow, { x: 5, y: 20 }, 1),
    },
    'resizeElement at one decimal': {
      input: noisyModel,
      run: (model) =>
        resizeElement(model, noisyProcess, { width: 125.04, height: 60.04 }, 1),
    },
    renameElement: {
      input: validModel,
      run: (model) =>
        renameElement(model, elementId('element-api'), 'Orders API'),
    },
    editNote: {
      input: withNote,
      run: (model) => editNote(model, elementId('element-note'), 'Edited'),
    },
    setElementDetails: {
      input: withNote,
      run: (model) =>
        setElementDetails(model, elementId('element-note'), {
          description: 'Seen on review.',
          outOfScope: true,
        }),
    },
    setAccent: {
      input: validModel,
      run: (model) =>
        setAccent(
          model,
          [elementId('element-api'), elementId('element-order-flow')],
          's3',
        ),
    },
    'setAccent clearing': {
      input: modelOf(setAccent(validModel, [elementId('element-api')], 's3')),
      run: (model) => setAccent(model, [elementId('element-api')], undefined),
    },
  });
});
