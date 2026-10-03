import { Either } from 'effect';
import { elementId, elementIn, flowIn, parsedFixture } from '../fixtures.js';
import { reconnectFlow, setFlowDirection } from './flow-operations.js';
import { validModelFixture } from './model.fixtures.js';
import { modelOf } from './operations.fixtures.js';
import type { Model } from './parse.js';
import {
  chosenDiagram,
  DiagramChoiceFailure,
  diagramsNamed,
  elementsAcross,
  elementsById,
  flowEndName,
  flowEnds,
  unlabelledFlow,
} from './references.js';

const model: Model = parsedFixture({
  ...validModelFixture,
  diagrams: [
    ...validModelFixture.diagrams,
    { id: 'diagram-second', title: 'Main data flow', elements: [] },
  ],
});

describe('diagramsNamed', () => {
  it('selects the diagram whose id the name is', () => {
    expect(
      diagramsNamed(model.diagrams, 'diagram-main').map((one) => one.id),
    ).toEqual(['diagram-main']);
  });

  it('selects every diagram whose title the name is exactly', () => {
    expect(
      diagramsNamed(model.diagrams, 'Main data flow').map((one) => one.id),
    ).toEqual(['diagram-main', 'diagram-second']);
  });

  it('puts the diagram whose id the name is before one titled with it', () => {
    const titledFirst = parsedFixture({
      ...validModelFixture,
      diagrams: [
        { id: 'diagram-titled', title: 'diagram-main', elements: [] },
        ...validModelFixture.diagrams,
      ],
    });
    expect(
      diagramsNamed(titledFirst.diagrams, 'diagram-main').map((one) => one.id),
    ).toEqual(['diagram-main', 'diagram-titled']);
  });

  it('selects nothing where the name is neither an id nor a title', () => {
    expect(diagramsNamed(model.diagrams, 'Main data')).toEqual([]);
  });

  it('selects nothing out of a model holding no diagram', () => {
    expect(diagramsNamed([], 'diagram-main')).toEqual([]);
  });
});

describe('chosenDiagram', () => {
  const [main, second] = model.diagrams;

  it('chooses the only diagram when no name is given', () => {
    expect(chosenDiagram([main], undefined)).toEqual(Either.right(main));
  });

  it('refuses to choose without a name among no diagram or several', () => {
    expect(chosenDiagram([], undefined)).toEqual(
      Either.left(DiagramChoiceFailure.NoDiagram()),
    );
    expect(chosenDiagram(model.diagrams, undefined)).toEqual(
      Either.left(
        DiagramChoiceFailure.SeveralDiagrams({ diagrams: model.diagrams }),
      ),
    );
  });

  it('chooses the first diagram a name selects', () => {
    expect(chosenDiagram(model.diagrams, 'diagram-second')).toEqual(
      Either.right(second),
    );
    expect(chosenDiagram(model.diagrams, 'Main data flow')).toEqual(
      Either.right(main),
    );
  });

  it('refuses a name that selects no diagram, carrying the diagrams', () => {
    expect(chosenDiagram(model.diagrams, 'Main data')).toEqual(
      Either.left(
        DiagramChoiceFailure.NoDiagramNamed({
          name: 'Main data',
          diagrams: model.diagrams,
        }),
      ),
    );
  });
});

describe('flowEnds', () => {
  const orderFlow = elementId('element-order-flow');
  const endsIn = (held: Model) =>
    flowEnds(
      flowIn(held, orderFlow),
      elementsById(elementsAcross(held.diagrams)),
    );

  it('gives the element an attached end is on and a free end as free', () => {
    expect(endsIn(model)).toEqual({
      source: {
        kind: 'element',
        element: elementIn(model, 'element-customer'),
      },
      target: { kind: 'free' },
      bidirectional: false,
    });
  });

  it('follows an end to the element it moves to, and the flow to running both ways', () => {
    const moved = modelOf(
      reconnectFlow(model, orderFlow, 'target', elementId('element-db')),
    );
    const both = modelOf(setFlowDirection(moved, orderFlow, true));
    expect(endsIn(both)).toEqual({
      source: {
        kind: 'element',
        element: elementIn(model, 'element-customer'),
      },
      target: { kind: 'element', element: elementIn(model, 'element-db') },
      bidirectional: true,
    });
  });

  it('gives the id of an attached element the lookup does not hold', () => {
    expect(flowEnds(flowIn(model, orderFlow), new Map()).source).toEqual({
      kind: 'missing',
      element: elementId('element-customer'),
    });
  });
});

describe('flowEndName', () => {
  const customer = elementIn(model, 'element-customer');

  it.each([
    [
      'an element by its name',
      { kind: 'element', element: customer },
      'Customer',
    ],
    [
      'an element with no name by its id',
      { kind: 'element', element: { ...customer, name: '' } },
      'element-customer',
    ],
    [
      'an element the lookup lacked by its id',
      { kind: 'missing', element: customer.id },
      'element-customer',
    ],
    ['a free end by the word given', { kind: 'free' }, 'loose'],
  ] as const)('calls %s', (_, end, called) => {
    expect(flowEndName(end, 'loose')).toBe(called);
  });
});

describe('unlabelledFlow', () => {
  const flow = flowIn(model, 'element-order-flow');

  it.each(['', ' \t'])('is a flow named %j', (name) => {
    expect(unlabelledFlow({ ...flow, name })).toEqual({ ...flow, name });
  });

  it('is nothing for a flow with a name or another kind with none', () => {
    expect(unlabelledFlow(flow)).toBeUndefined();
    expect(
      unlabelledFlow({ ...elementIn(model, 'element-customer'), name: '' }),
    ).toBeUndefined();
  });
});
