import type { FlowInput } from './elements.js';
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

const flow = (
  id: string,
  name: string,
  source: string,
  target: string,
): FlowInput => ({
  kind: 'flow',
  id,
  name,
  ...described,
  source: { kind: 'attached', element: source },
  target: { kind: 'attached', element: target },
  bidirectional: false,
});

/**
 * A model of two diagrams made before an element could stand on more than
 * one, so each diagram holds its own copy: an Orders API process, a Stock
 * store, the Reserve flow between them and a Backend boundary on each, every
 * element placed once. A threat sits on the storefront's Orders API, one on
 * the fulfilment Stock, and one on both Reserve flows. A Web shop on the
 * storefront sends Order to its Orders API, pinned to its left side.
 */
export const copiesModelInput: ModelInput = {
  metadata: {
    title: 'Orders',
    owner: '',
    description: '',
    contributors: [],
  },
  elements: [
    { kind: 'actor', id: 'shopper', name: 'Shopper', ...described },
    { kind: 'process', id: 'web-shop', name: 'Web shop', ...described },
    { kind: 'process', id: 'orders-api', name: 'Orders API', ...described },
    { kind: 'store', id: 'stock', name: 'Stock', ...described },
    flow('browse', 'Browse', 'shopper', 'web-shop'),
    flow('order', 'Order', 'web-shop', 'orders-api'),
    flow('reserve', 'Reserve', 'orders-api', 'stock'),
    {
      kind: 'trust-boundary',
      id: 'backend',
      name: 'Backend',
      ...described,
      containedElements: ['orders-api', 'stock'],
      crossingFlows: ['order'],
    },
    {
      kind: 'process',
      id: 'orders-api-copy',
      name: 'Orders API',
      ...described,
    },
    { kind: 'store', id: 'stock-copy', name: 'Stock', ...described },
    {
      ...flow('reserve-copy', 'Reserve', 'orders-api-copy', 'stock-copy'),
      trustBoundaryIds: ['backend-copy'],
    },
    {
      kind: 'trust-boundary',
      id: 'backend-copy',
      name: 'Backend',
      ...described,
      containedElements: ['orders-api-copy', 'stock-copy'],
    },
  ],
  diagrams: [
    {
      id: 'storefront',
      title: 'Storefront',
      placements: [
        {
          element: 'backend',
          shape: { kind: 'box', ...box(380, 60, 400, 180) },
        },
        { element: 'shopper', ...box(40, 120, 120, 60) },
        { element: 'web-shop', ...box(200, 120) },
        { element: 'orders-api', ...box(420, 120), accent: 's1' },
        { element: 'stock', ...box(620, 120, 120, 60) },
        { element: 'browse', ...route() },
        { element: 'order', ...route({ side: 'left' }) },
        { element: 'reserve', ...route() },
      ],
    },
    {
      id: 'fulfilment',
      title: 'Fulfilment',
      placements: [
        {
          element: 'backend-copy',
          shape: { kind: 'box', ...box(20, 40, 380, 160) },
        },
        { element: 'orders-api-copy', ...box(40, 90) },
        { element: 'stock-copy', ...box(240, 90, 120, 60) },
        { element: 'reserve-copy', ...route() },
      ],
    },
  ],
  threats: [
    {
      id: 'threat-order-tampered',
      number: 1,
      title: 'Order tampered with',
      category: { methodology: 'STRIDE', category: 'tampering' },
      severity: 'high',
      status: 'open',
      description: '',
      elements: ['orders-api'],
      appliesToModel: false,
    },
    {
      id: 'threat-stock-read',
      number: 2,
      title: 'Stock levels read',
      category: { methodology: 'STRIDE', category: 'information-disclosure' },
      severity: 'medium',
      status: 'open',
      description: '',
      elements: ['stock-copy'],
      appliesToModel: false,
    },
    {
      id: 'threat-reservation-replayed',
      number: 3,
      title: 'Reservation replayed',
      category: { methodology: 'STRIDE', category: 'spoofing' },
      severity: 'medium',
      status: 'open',
      description: '',
      elements: ['reserve', 'reserve-copy'],
      appliesToModel: false,
    },
  ],
  lastIssuedThreatNumber: 3,
  mitigations: [],
  assumptions: [],
};
