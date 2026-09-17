const heading = `formatVersion: 1
metadata:
  title: Small
  owner: Owner
  description: ''
  contributors: []
assumptions: []
mitigations: []
`;

const oneThreat = `threats:
  - id: threat-1
    number: 1
    title: Spoofed caller
    category: { methodology: STRIDE, category: spoofing }
    severity: high
    status: open
    description: ''
    mitigation: ''
    elements: []
lastIssuedThreatNumber: 1
`;

const processElement = (id: string, x: number): string => `      - kind: process
        id: ${id}
        name: ${id}
        description: ''
        outOfScope: false
        reasonOutOfScope: ''
        position: { x: ${String(x)}, y: 0 }
        size: { width: 10, height: 10 }
`;

const flow = (id: string, target: string): string => `      - kind: flow
        id: ${id}
        name: ${id}
        description: ''
        outOfScope: false
        reasonOutOfScope: ''
        source: { kind: attached, element: element-1 }
        target: { kind: attached, element: ${target} }
        waypoints: []
`;

/**
 * A version 1 native file whose one process, on one diagram, is named by the
 * file's one threat as the given element id.
 */
export const referencingYaml = (element: string): string => `${heading}diagrams:
  - id: only
    title: Only
    elements:
${processElement('element-1', 0)}threats:
  - id: threat-1
    number: 1
    title: Spoofed caller
    category: { methodology: STRIDE, category: spoofing }
    severity: high
    status: open
    description: ''
    mitigation: ''
    elements: [${element}]
lastIssuedThreatNumber: 1
`;

/**
 * A version 1 native file of one threat and no diagram, so there is nothing
 * to draw. A spec derives a variant with a `replace`.
 */
export const smallYaml = `${heading}diagrams: []
${oneThreat}`;

/** A YAML text no registered codec claims. */
export const unclaimedYaml = 'hello: world\n';

/** The name a tree gives {@link unclaimedYaml}. */
export const unclaimedFile = 'unclaimed.yaml';

/**
 * A native file whose second flow ends on the first flow. The model permits
 * an endpoint on any element and the canvas draws a flow as no box, so the
 * layout reports the endpoint and leaves that flow out of the drawing.
 */
export const unplacedFlowYaml = `${heading}diagrams:
  - id: only
    title: Only
    elements:
${processElement('element-1', 0)}${processElement('element-2', 100)}${flow(
  'flow-1',
  'element-2',
)}${flow('flow-2', 'flow-1')}${oneThreat}`;
