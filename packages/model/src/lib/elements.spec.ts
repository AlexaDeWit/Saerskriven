import {
  drawnElementSchema,
  drawnFlowEndpointSchema,
  drawnFlowSchema,
} from './drawn-elements.js';
import {
  actorSchema,
  elementKindSchema,
  elementSchema,
  flowEndpointSchema,
  flowSchema,
  type Element,
} from './elements.js';
import { boundaryShapeSchema } from './placements.js';

const actor = {
  kind: 'actor',
  id: 'element-customer',
  name: 'Customer',
  description: 'Places orders from a browser.',
  outOfScope: false,
  reasonOutOfScope: '',
  position: { x: 40, y: 120 },
  size: { width: 160, height: 80 },
};

const attachedFlow = {
  kind: 'flow',
  id: 'element-order-flow',
  name: 'Submit order',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  source: { kind: 'attached', element: 'element-customer' },
  target: { kind: 'attached', element: 'element-api' },
  waypoints: [],
  bidirectional: false,
};

describe('actorSchema', () => {
  it('ties the scoping pair by convention only: either field stands alone', () => {
    expect(actorSchema.safeParse({ ...actor, outOfScope: true }).success).toBe(
      true,
    );
    expect(
      actorSchema.safeParse({
        ...actor,
        reasonOutOfScope: 'Out of the service perimeter.',
      }).success,
    ).toBe(true);
  });
});

describe('elementSchema', () => {
  it('holds no accent and no geometry, which belong to a placement', () => {
    expect(elementSchema.parse({ ...actor, accent: 's1' })).toEqual({
      kind: 'actor',
      id: 'element-customer',
      name: 'Customer',
      description: 'Places orders from a browser.',
      outOfScope: false,
      reasonOutOfScope: '',
    });
    expect(elementSchema.parse(attachedFlow)).not.toHaveProperty('waypoints');
  });
});

describe('accent', () => {
  it('is drawn on every kind, a canvas note included', () => {
    const accented = drawnElementSchema.options
      .filter((option) => Object.hasOwn(option.shape, 'accent'))
      .map((option) => option.shape.kind.value);
    expect(accented).toEqual(elementKindSchema.options);
    expect(
      drawnElementSchema.parse({
        ...actor,
        kind: 'text',
        text: '',
        accent: 's1',
      }),
    ).toHaveProperty('accent', 's1');
  });
});

describe('flowEndpointSchema', () => {
  it('names the element an attached end is on, and leaves its side to each diagram', () => {
    expect(
      flowEndpointSchema.parse({
        kind: 'attached',
        element: 'api',
        side: 'bottom',
      }),
    ).toEqual({ kind: 'attached', element: 'api' });
  });
});

describe('drawnFlowEndpointSchema', () => {
  it('parses an attached endpoint pinned to a side, and refuses a side that is not one', () => {
    expect(
      drawnFlowEndpointSchema.safeParse({
        kind: 'attached',
        element: 'api',
        side: 'bottom',
      }).success,
    ).toBe(true);
    expect(
      drawnFlowEndpointSchema.safeParse({
        kind: 'attached',
        element: 'api',
        side: 'middle',
      }).success,
    ).toBe(false);
  });
});

describe('flowSchema', () => {
  it('draws no flow without waypoints', () => {
    const { waypoints: _waypoints, ...rest } = attachedFlow;
    expect(drawnFlowSchema.safeParse(rest).success).toBe(false);
  });

  it('requires the direction rather than defaulting it', () => {
    const { bidirectional: _bidirectional, ...rest } = attachedFlow;
    expect(flowSchema.safeParse(rest).success).toBe(false);
    expect(
      flowSchema.safeParse({ ...attachedFlow, bidirectional: true }).success,
    ).toBe(true);
  });
});

describe('boundaryShapeSchema', () => {
  it('rejects a curve with fewer than two waypoints', () => {
    expect(
      boundaryShapeSchema.safeParse({
        kind: 'curve',
        waypoints: [{ x: 0, y: 0 }],
      }).success,
    ).toBe(false);
  });
});

describe('elementKindSchema', () => {
  it('names every kind the element union discriminates on', () => {
    const named: readonly Element['kind'][] = elementKindSchema.options;
    expect(new Set(named)).toEqual(
      new Set(elementSchema.options.map((option) => option.shape.kind.value)),
    );
  });
});
