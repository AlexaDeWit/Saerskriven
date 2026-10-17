import type { ModelInput } from './model.js';

const described = {
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
};

const box = (x: number, y: number, width = 140, height = 60) => ({
  position: { x, y },
  size: { width, height },
});

const route = (target: object = {}) => ({
  waypoints: [],
  source: {},
  target,
});

/**
 * A model of two diagrams sharing elements, in the model's own shape: a
 * process, a trust boundary and a note placed on both, a flow drawn on both
 * whose target is drawn away from its store on the overview, a boundary on
 * both listing a member only the payments diagram places, and a threat on
 * the shared process and one on the shared flow.
 */
export const sharedModelInput: ModelInput = {
  metadata: {
    title: 'Card payments',
    owner: '',
    description: '',
    contributors: [],
  },
  elements: [
    { kind: 'actor', id: 'customer', name: 'Customer', ...described },
    { kind: 'process', id: 'web-app', name: 'Web app', ...described },
    {
      kind: 'process',
      id: 'payments-api',
      name: 'Payments API',
      ...described,
    },
    { kind: 'store', id: 'card-vault', name: 'Card vault', ...described },
    { kind: 'process', id: 'fraud-check', name: 'Fraud check', ...described },
    {
      kind: 'flow',
      id: 'sign-in',
      name: 'Sign in',
      ...described,
      source: { kind: 'attached', element: 'customer' },
      target: { kind: 'attached', element: 'web-app' },
      bidirectional: false,
    },
    {
      kind: 'flow',
      id: 'card-details',
      name: 'Card details',
      ...described,
      source: { kind: 'attached', element: 'web-app' },
      target: { kind: 'attached', element: 'payments-api' },
      bidirectional: false,
    },
    {
      kind: 'flow',
      id: 'charge',
      name: 'Charge',
      ...described,
      source: { kind: 'attached', element: 'payments-api' },
      target: { kind: 'attached', element: 'card-vault' },
      bidirectional: false,
    },
    {
      kind: 'flow',
      id: 'score',
      name: 'Score',
      ...described,
      source: { kind: 'attached', element: 'fraud-check' },
      target: { kind: 'attached', element: 'payments-api' },
      bidirectional: false,
    },
    {
      kind: 'trust-boundary',
      id: 'payments-zone',
      name: 'Payments zone',
      ...described,
      containedElements: ['payments-api', 'card-vault'],
      crossingFlows: ['card-details'],
    },
    {
      kind: 'text',
      id: 'legend',
      name: '',
      ...described,
      text: 'Shared elements stand on both diagrams.',
    },
  ],
  diagrams: [
    {
      id: 'overview',
      title: 'High level',
      placements: [
        {
          element: 'payments-zone',
          shape: { kind: 'box', ...box(380, 140, 240, 140) },
        },
        { element: 'customer', ...box(40, 180, 120, 60) },
        { element: 'web-app', ...box(200, 180) },
        { element: 'payments-api', ...box(420, 180), accent: 's1' },
        { element: 'legend', ...box(40, 320, 220, 60) },
        { element: 'sign-in', ...route() },
        { element: 'card-details', ...route() },
        {
          element: 'charge',
          ...route({ position: { x: 680, y: 210 } }),
        },
      ],
    },
    {
      id: 'payments',
      title: 'Payments',
      placements: [
        {
          element: 'payments-zone',
          shape: { kind: 'box', ...box(220, 60, 420, 160) },
        },
        { element: 'fraud-check', ...box(40, 100) },
        { element: 'payments-api', ...box(240, 100) },
        { element: 'card-vault', ...box(460, 100, 120, 60) },
        { element: 'legend', ...box(40, 260, 220, 60) },
        { element: 'charge', ...route() },
        { element: 'score', ...route() },
      ],
    },
  ],
  threats: [
    {
      id: 'threat-card-data',
      number: 1,
      title: 'Card data read from the API',
      category: { methodology: 'STRIDE', category: 'information-disclosure' },
      severity: 'high',
      status: 'open',
      description: '',
      elements: ['payments-api'],
      appliesToModel: false,
    },
    {
      id: 'threat-charge-replay',
      number: 2,
      title: 'Charge replayed',
      category: { methodology: 'STRIDE', category: 'tampering' },
      severity: 'medium',
      status: 'open',
      description: '',
      elements: ['charge'],
      appliesToModel: false,
    },
  ],
  lastIssuedThreatNumber: 2,
  mitigations: [],
  assumptions: [],
};
