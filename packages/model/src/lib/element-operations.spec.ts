import { Either } from 'effect';
import {
  diagramId,
  elementId,
  elementIn,
  flowIn,
  parsedFixture,
  securityModelFixture,
  softHyphen,
  validModel,
} from '../fixtures.js';
import { addDiagram } from './diagram-operations.js';
import {
  addElement,
  editNote,
  moveElement,
  removeElement,
  renameElement,
  resizeElement,
} from './element-operations.js';
import { elementSchema } from './elements.js';
import { validModelFixture } from './model.fixtures.js';
import { OperationFailure } from './operation-failures.js';
import {
  cache,
  elementIds,
  errorOf,
  flowInput,
  mainDiagram,
  modelOf,
  operationContract,
  storeInput,
  withNote,
  writeFlow,
} from './operations.fixtures.js';
import { parseModel } from './parse.js';

const secured = parsedFixture(securityModelFixture);

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
    const seeded = [spur, tap].reduce(
      (model, flow) => modelOf(addElement(model, mainDiagram, flow)),
      validModel,
    );
    const next = modelOf(removeElement(seeded, elementId('element-spur-flow')));
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
    const seeded = [writeFlow, meter].reduce(
      (model, flow) => modelOf(addElement(model, mainDiagram, flow)),
      validModel,
    );
    const next = modelOf(
      removeElement(seeded, elementId('element-write-flow')),
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

  it('refuses an empty name', () => {
    expect(
      errorOf(renameElement(validModel, elementId('element-api'), '')),
    ).toEqual(
      OperationFailure.EmptyName({ elementId: elementId('element-api') }),
    );
  });

  it('refuses a name of whitespace, which draws as no name at all', () => {
    expect(
      errorOf(renameElement(validModel, elementId('element-api'), '   ')),
    ).toEqual(
      OperationFailure.EmptyName({ elementId: elementId('element-api') }),
    );
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
    renameElement: {
      input: validModel,
      run: (model) =>
        renameElement(model, elementId('element-api'), 'Orders API'),
    },
    editNote: {
      input: withNote,
      run: (model) => editNote(model, elementId('element-note'), 'Edited'),
    },
  });
});
