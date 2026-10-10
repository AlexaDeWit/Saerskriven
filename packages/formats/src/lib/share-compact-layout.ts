import type { CompactLayout } from './share-compact-types.js';

/** Frozen field positions and vocabularies for experimental share encoding 2. */
export const compactLayouts: readonly CompactLayout[] = [
  {
    kind: 'literal',
    value: 2,
  },
  {
    kind: 'string',
  },
  {
    kind: 'array',
    element: 1,
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'title',
        layout: 1,
      },
      {
        name: 'owner',
        layout: 1,
      },
      {
        name: 'description',
        layout: 1,
      },
      {
        name: 'contributors',
        layout: 2,
      },
    ],
  },
  {
    kind: 'enum',
    values: ['unconfirmed', 'valid', 'invalidated'],
  },
  {
    kind: 'boolean',
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'id',
        layout: 1,
      },
      {
        name: 'prose',
        layout: 1,
      },
      {
        name: 'status',
        layout: 4,
      },
      {
        name: 'threats',
        layout: 2,
      },
      {
        name: 'appliesToModel',
        layout: 5,
      },
    ],
  },
  {
    kind: 'array',
    element: 6,
  },
  {
    kind: 'optional',
    value: 1,
  },
  {
    kind: 'number',
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'x',
        layout: 9,
      },
      {
        name: 'y',
        layout: 9,
      },
    ],
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'width',
        layout: 9,
      },
      {
        name: 'height',
        layout: 9,
      },
    ],
  },
  {
    kind: 'literal',
    value: 'actor',
  },
  {
    kind: 'optional',
    value: 5,
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'id',
        layout: 1,
      },
      {
        name: 'name',
        layout: 1,
      },
      {
        name: 'description',
        layout: 1,
      },
      {
        name: 'outOfScope',
        layout: 5,
      },
      {
        name: 'reasonOutOfScope',
        layout: 1,
      },
      {
        name: 'accent',
        layout: 8,
      },
      {
        name: 'position',
        layout: 10,
      },
      {
        name: 'size',
        layout: 11,
      },
      {
        name: 'kind',
        layout: 12,
      },
      {
        name: 'providesAuthentication',
        layout: 13,
      },
    ],
  },
  {
    kind: 'literal',
    value: 'process',
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'id',
        layout: 1,
      },
      {
        name: 'name',
        layout: 1,
      },
      {
        name: 'description',
        layout: 1,
      },
      {
        name: 'outOfScope',
        layout: 5,
      },
      {
        name: 'reasonOutOfScope',
        layout: 1,
      },
      {
        name: 'accent',
        layout: 8,
      },
      {
        name: 'position',
        layout: 10,
      },
      {
        name: 'size',
        layout: 11,
      },
      {
        name: 'kind',
        layout: 15,
      },
      {
        name: 'handlesCardPayment',
        layout: 13,
      },
      {
        name: 'handlesGoodsOrServices',
        layout: 13,
      },
      {
        name: 'isWebApplication',
        layout: 13,
      },
      {
        name: 'privilegeLevel',
        layout: 8,
      },
    ],
  },
  {
    kind: 'literal',
    value: 'store',
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'id',
        layout: 1,
      },
      {
        name: 'name',
        layout: 1,
      },
      {
        name: 'description',
        layout: 1,
      },
      {
        name: 'outOfScope',
        layout: 5,
      },
      {
        name: 'reasonOutOfScope',
        layout: 1,
      },
      {
        name: 'accent',
        layout: 8,
      },
      {
        name: 'position',
        layout: 10,
      },
      {
        name: 'size',
        layout: 11,
      },
      {
        name: 'kind',
        layout: 17,
      },
      {
        name: 'isALog',
        layout: 13,
      },
      {
        name: 'isEncrypted',
        layout: 13,
      },
      {
        name: 'isSigned',
        layout: 13,
      },
      {
        name: 'storesCredentials',
        layout: 13,
      },
      {
        name: 'storesInventory',
        layout: 13,
      },
    ],
  },
  {
    kind: 'literal',
    value: 'flow',
  },
  {
    kind: 'optional',
    value: 2,
  },
  {
    kind: 'literal',
    value: 'attached',
  },
  {
    kind: 'enum',
    values: ['top', 'right', 'bottom', 'left'],
  },
  {
    kind: 'optional',
    value: 22,
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'kind',
        layout: 21,
      },
      {
        name: 'element',
        layout: 1,
      },
      {
        name: 'side',
        layout: 23,
      },
    ],
  },
  {
    kind: 'literal',
    value: 'free',
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'kind',
        layout: 25,
      },
      {
        name: 'position',
        layout: 10,
      },
    ],
  },
  {
    kind: 'variant',
    discriminator: 'kind',
    options: [24, 26],
  },
  {
    kind: 'array',
    element: 10,
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'id',
        layout: 1,
      },
      {
        name: 'name',
        layout: 1,
      },
      {
        name: 'description',
        layout: 1,
      },
      {
        name: 'outOfScope',
        layout: 5,
      },
      {
        name: 'reasonOutOfScope',
        layout: 1,
      },
      {
        name: 'accent',
        layout: 8,
      },
      {
        name: 'kind',
        layout: 19,
      },
      {
        name: 'protocol',
        layout: 8,
      },
      {
        name: 'isEncrypted',
        layout: 13,
      },
      {
        name: 'isPublicNetwork',
        layout: 13,
      },
      {
        name: 'trustBoundaryIds',
        layout: 20,
      },
      {
        name: 'source',
        layout: 27,
      },
      {
        name: 'target',
        layout: 27,
      },
      {
        name: 'waypoints',
        layout: 28,
      },
      {
        name: 'bidirectional',
        layout: 13,
      },
    ],
  },
  {
    kind: 'literal',
    value: 'trust-boundary',
  },
  {
    kind: 'literal',
    value: 'box',
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'kind',
        layout: 31,
      },
      {
        name: 'position',
        layout: 10,
      },
      {
        name: 'size',
        layout: 11,
      },
    ],
  },
  {
    kind: 'literal',
    value: 'curve',
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'kind',
        layout: 33,
      },
      {
        name: 'waypoints',
        layout: 28,
      },
    ],
  },
  {
    kind: 'variant',
    discriminator: 'kind',
    options: [32, 34],
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'id',
        layout: 1,
      },
      {
        name: 'name',
        layout: 1,
      },
      {
        name: 'description',
        layout: 1,
      },
      {
        name: 'outOfScope',
        layout: 5,
      },
      {
        name: 'reasonOutOfScope',
        layout: 1,
      },
      {
        name: 'accent',
        layout: 8,
      },
      {
        name: 'kind',
        layout: 30,
      },
      {
        name: 'containedElements',
        layout: 20,
      },
      {
        name: 'crossingFlows',
        layout: 20,
      },
      {
        name: 'shape',
        layout: 35,
      },
    ],
  },
  {
    kind: 'literal',
    value: 'text',
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'id',
        layout: 1,
      },
      {
        name: 'name',
        layout: 1,
      },
      {
        name: 'description',
        layout: 1,
      },
      {
        name: 'outOfScope',
        layout: 5,
      },
      {
        name: 'reasonOutOfScope',
        layout: 1,
      },
      {
        name: 'position',
        layout: 10,
      },
      {
        name: 'size',
        layout: 11,
      },
      {
        name: 'kind',
        layout: 37,
      },
      {
        name: 'text',
        layout: 1,
      },
    ],
  },
  {
    kind: 'variant',
    discriminator: 'kind',
    options: [14, 16, 18, 29, 36, 38],
  },
  {
    kind: 'array',
    element: 39,
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'id',
        layout: 1,
      },
      {
        name: 'title',
        layout: 1,
      },
      {
        name: 'elements',
        layout: 40,
      },
    ],
  },
  {
    kind: 'array',
    element: 41,
  },
  {
    kind: 'enum',
    values: ['proposed', 'implemented', 'verified'],
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'id',
        layout: 1,
      },
      {
        name: 'title',
        layout: 1,
      },
      {
        name: 'prose',
        layout: 1,
      },
      {
        name: 'status',
        layout: 43,
      },
      {
        name: 'threats',
        layout: 2,
      },
    ],
  },
  {
    kind: 'array',
    element: 44,
  },
  {
    kind: 'literal',
    value: 'STRIDE',
  },
  {
    kind: 'enum',
    values: [
      'spoofing',
      'tampering',
      'repudiation',
      'information-disclosure',
      'denial-of-service',
      'elevation-of-privilege',
    ],
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'methodology',
        layout: 46,
      },
      {
        name: 'category',
        layout: 47,
      },
    ],
  },
  {
    kind: 'literal',
    value: 'LINDDUN',
  },
  {
    kind: 'enum',
    values: [
      'linking',
      'identifying',
      'non-repudiation',
      'detecting',
      'data-disclosure',
      'unawareness',
      'non-compliance',
    ],
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'methodology',
        layout: 49,
      },
      {
        name: 'category',
        layout: 50,
      },
    ],
  },
  {
    kind: 'literal',
    value: 'CIA',
  },
  {
    kind: 'enum',
    values: ['confidentiality', 'integrity', 'availability'],
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'methodology',
        layout: 52,
      },
      {
        name: 'category',
        layout: 53,
      },
    ],
  },
  {
    kind: 'literal',
    value: 'CIA-DIE',
  },
  {
    kind: 'enum',
    values: [
      'confidentiality',
      'integrity',
      'availability',
      'distributed',
      'immutable',
      'ephemeral',
    ],
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'methodology',
        layout: 55,
      },
      {
        name: 'category',
        layout: 56,
      },
    ],
  },
  {
    kind: 'literal',
    value: 'PLOT4ai',
  },
  {
    kind: 'enum',
    values: [
      'accountability-and-human-oversight',
      'bias-fairness-and-discrimination',
      'cybersecurity',
      'data-and-data-governance',
      'ethics-and-human-rights',
      'privacy-and-data-protection',
      'safety-and-environmental-impact',
      'transparency-and-accessibility',
    ],
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'methodology',
        layout: 58,
      },
      {
        name: 'category',
        layout: 59,
      },
    ],
  },
  {
    kind: 'literal',
    value: 'custom',
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'methodology',
        layout: 61,
      },
      {
        name: 'methodologyName',
        layout: 1,
      },
      {
        name: 'category',
        layout: 1,
      },
    ],
  },
  {
    kind: 'variant',
    discriminator: 'methodology',
    options: [48, 51, 54, 57, 60, 62],
  },
  {
    kind: 'enum',
    values: ['low', 'medium', 'high', 'critical', 'undecided'],
  },
  {
    kind: 'enum',
    values: [
      'open',
      'mitigated',
      'transferred',
      'avoided',
      'accepted-risk',
      'eliminated',
      'not-applicable',
    ],
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'id',
        layout: 1,
      },
      {
        name: 'number',
        layout: 9,
      },
      {
        name: 'title',
        layout: 1,
      },
      {
        name: 'category',
        layout: 63,
      },
      {
        name: 'severity',
        layout: 64,
      },
      {
        name: 'status',
        layout: 65,
      },
      {
        name: 'description',
        layout: 1,
      },
      {
        name: 'elements',
        layout: 2,
      },
      {
        name: 'appliesToModel',
        layout: 13,
      },
    ],
  },
  {
    kind: 'array',
    element: 66,
  },
  {
    kind: 'object',
    fields: [
      {
        name: 'formatVersion',
        layout: 0,
      },
      {
        name: 'metadata',
        layout: 3,
      },
      {
        name: 'assumptions',
        layout: 7,
      },
      {
        name: 'diagrams',
        layout: 42,
      },
      {
        name: 'mitigations',
        layout: 45,
      },
      {
        name: 'threats',
        layout: 67,
      },
      {
        name: 'lastIssuedThreatNumber',
        layout: 9,
      },
    ],
  },
];

/** The document layout in the frozen table. */
export const compactRoot = 68;
