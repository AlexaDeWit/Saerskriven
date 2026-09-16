import { diagramSchema, modelMetadataSchema, modelSchema } from './model.js';

const metadata = {
  title: 'Order service',
  owner: 'Alexandra de Wit',
  description: 'Sample model exercising every record kind.',
  contributors: ['Alexandra de Wit'],
};

const actor = {
  kind: 'actor',
  id: 'element-customer',
  name: 'Customer',
  description: 'Places orders from a browser.',
  outOfScope: false,
  reasonOutOfScope: '',
  position: { x: 10, y: 350 },
  size: { width: 170, height: 90 },
};

const flow = {
  kind: 'flow',
  id: 'element-order-flow',
  name: 'Submit order',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  source: {
    kind: 'attached',
    element: 'element-customer',
  },
  target: { kind: 'free', position: { x: 700, y: 400 } },
  waypoints: [],
  bidirectional: false,
};

const diagram = {
  id: 'diagram-main',
  title: 'Main data flow',
  elements: [actor, flow],
};

const threat = {
  id: 'threat-tamper-order',
  number: 101,
  title: 'Order tampering in transit',
  category: { methodology: 'STRIDE', category: 'tampering' },
  severity: 'high',
  status: 'accepted-risk',
  description: 'An order can be altered between the customer and the API.',
  elements: ['element-api'],
};

const mitigation = {
  id: 'mitigation-tls',
  title: 'TLS on the order flow',
  prose: 'Terminate TLS at the perimeter and pin the certificate.',
  status: 'implemented',
  threats: ['threat-tamper-order'],
};

const assumption = {
  id: 'assumption-managed-db',
  prose: 'The order database encrypts its disks.',
  status: 'valid',
  threats: ['threat-tamper-order'],
  appliesToModel: false,
};

const emptyRecords = {
  threats: [],
  lastIssuedThreatNumber: 0,
  mitigations: [],
  assumptions: [],
};

describe('modelMetadataSchema', () => {
  it('parses title, owner, description, and contributors', () => {
    expect(modelMetadataSchema.parse(metadata)).toEqual(metadata);
  });

  it('accepts an empty description', () => {
    expect(
      modelMetadataSchema.safeParse({ ...metadata, description: '' }).success,
    ).toBe(true);
  });

  it('accepts a model no one has been credited on yet', () => {
    expect(
      modelMetadataSchema.safeParse({ ...metadata, contributors: [] }).success,
    ).toBe(true);
  });
});

describe('diagramSchema', () => {
  it('parses a diagram owning mixed elements', () => {
    expect(diagramSchema.parse(diagram)).toEqual(diagram);
  });
});

describe('modelSchema', () => {
  it('parses metadata, diagrams, threats, mitigations, and assumptions', () => {
    const model = {
      metadata,
      diagrams: [diagram],
      threats: [threat],
      lastIssuedThreatNumber: 101,
      mitigations: [mitigation],
      assumptions: [assumption],
    };
    expect(modelSchema.parse(model)).toEqual(model);
  });

  it('accepts empty diagrams, elements, and record arrays', () => {
    expect(
      modelSchema.safeParse({ metadata, diagrams: [], ...emptyRecords })
        .success,
    ).toBe(true);
    expect(
      modelSchema.safeParse({
        metadata,
        diagrams: [{ ...diagram, elements: [] }],
        ...emptyRecords,
      }).success,
    ).toBe(true);
  });

  it("accepts duplicate element ids: model-wide uniqueness is parseModel's refinement", () => {
    const twice = { ...diagram, elements: [actor, actor] };
    expect(
      modelSchema.safeParse({ metadata, diagrams: [twice], ...emptyRecords })
        .success,
    ).toBe(true);
  });

  it("accepts duplicate threat numbers: model-wide uniqueness is parseModel's refinement", () => {
    const twin = { ...threat, id: 'another-threat' };
    expect(
      modelSchema.safeParse({
        metadata,
        diagrams: [],
        ...emptyRecords,
        threats: [threat, twin],
      }).success,
    ).toBe(true);
  });

  it("accepts a last issued number below a threat it holds: the ceiling is parseModel's refinement", () => {
    expect(
      modelSchema.safeParse({
        metadata,
        diagrams: [],
        ...emptyRecords,
        threats: [threat],
      }).success,
    ).toBe(true);
  });
});
