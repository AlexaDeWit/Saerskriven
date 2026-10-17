import {
  saerskrivenYamlV3WireSchema,
  type SaerskrivenYamlV3Document,
} from './saerskriven-yaml-v3-wire.js';

const document: SaerskrivenYamlV3Document = {
  formatVersion: 3,
  metadata: {
    title: 'One threat',
    owner: '',
    description: '',
    contributors: [],
  },
  assumptions: [],
  diagrams: [
    {
      id: 'diagram-1',
      title: 'Only',
      placements: [
        {
          element: 'element-1',
          position: { x: 0, y: 0 },
          size: { width: 10, height: 10 },
        },
        {
          element: 'flow-1',
          waypoints: [],
          source: { side: 'right' },
          target: { position: { x: 40, y: 0 } },
        },
      ],
    },
  ],
  elements: [
    {
      kind: 'process',
      id: 'element-1',
      name: 'Gateway',
      description: '',
      outOfScope: false,
      reasonOutOfScope: '',
    },
    {
      kind: 'flow',
      id: 'flow-1',
      name: 'Requests',
      description: '',
      outOfScope: false,
      reasonOutOfScope: '',
      source: { kind: 'attached', element: 'element-1' },
      target: { kind: 'free' },
      bidirectional: false,
    },
  ],
  mitigations: [],
  threats: [
    {
      id: 'threat-1',
      number: 1,
      title: 'Spoofed caller',
      category: { methodology: 'STRIDE', category: 'spoofing' },
      severity: 'high',
      status: 'open',
      description: '',
      elements: ['element-1'],
    },
  ],
  lastIssuedThreatNumber: 1,
};

function parsedOf(value: unknown) {
  const result = saerskrivenYamlV3WireSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

function issuePathsOf(value: unknown) {
  const result = saerskrivenYamlV3WireSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

describe('the Saerskriven YAML version 3 wire schema', () => {
  it('reads a file holding elements at the root and placements on a diagram', () => {
    expect(parsedOf(document)).toEqual(document);
  });

  it('refuses a version 2 file, at that path', () => {
    expect(issuePathsOf({ ...document, formatVersion: 2 })).toEqual([
      ['formatVersion'],
    ]);
  });

  it('reads an accent on a placement as text, a key no release knows included', () => {
    const [process, flow] = document.diagrams[0].placements;
    const accented = {
      ...document,
      diagrams: [
        {
          ...document.diagrams[0],
          placements: [
            { ...process, accent: 'a key of a later release' },
            flow,
          ],
        },
      ],
    };
    expect(parsedOf(accented)).toEqual(accented);
  });

  it('drops the geometry and accent version 2 kept on an element', () => {
    const [process, flow] = document.elements;
    expect(
      parsedOf({
        ...document,
        elements: [
          { ...process, accent: 's1', position: { x: 0, y: 0 } },
          { ...flow, waypoints: [] },
        ],
      }),
    ).toEqual(document);
  });
});
