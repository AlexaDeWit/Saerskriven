import { saerskrivenYamlWireSchema } from '@saerskriven/wire-saerskriven-yaml';
import {
  saerskrivenYamlV2WireSchema,
  type SaerskrivenYamlV2Document,
} from '@saerskriven/wire-saerskriven-yaml-v2';
import type { SaerskrivenYamlDocument } from '@saerskriven/wire-saerskriven-yaml';
import type { canonicalOrder } from './canonical-order.js';
import {
  currentSaerskrivenYaml,
  saerskrivenYamlVersionsSchema,
} from './saerskriven-yaml-migration.js';

type Schema = Parameters<typeof canonicalOrder>[0];

function declaredKeys(schema: Schema, prefix = ''): string[] {
  const { shape, element, options } = schema.def;
  if (shape !== undefined) {
    return Object.entries(shape).flatMap(([key, field]) => [
      `${prefix}${key}${field.def.type === 'optional' ? '?' : ''}`,
      ...declaredKeys(field, `${prefix}${key}.`),
    ]);
  }
  if (element !== undefined) {
    return declaredKeys(element, prefix);
  }
  return (options ?? []).flatMap((option) => declaredKeys(option, prefix));
}

const threat = (id: string, number: number, status: string, text: string) => ({
  id,
  number,
  title: `Threat ${String(number)}`,
  category: { methodology: 'STRIDE', category: 'spoofing' },
  severity: 'high',
  status,
  description: '',
  mitigation: text,
  elements: [],
});

const version1: SaerskrivenYamlDocument = saerskrivenYamlWireSchema.parse({
  formatVersion: 1,
  metadata: { title: 'Earlier', owner: '', description: '', contributors: [] },
  diagrams: [],
  threats: [
    threat('threat-1', 1, 'mitigated', 'Sign every request.'),
    threat('threat-2', 2, 'open', 'Rotate the key.'),
    threat('threat-3', 3, 'accepted-risk', ''),
  ],
  lastIssuedThreatNumber: 3,
  mitigations: [
    {
      id: 'mitigation-held',
      title: 'Held',
      prose: '',
      status: 'verified',
      threats: ['threat-3'],
    },
  ],
  assumptions: [
    {
      id: 'assumption-linked',
      prose: 'Callers sit behind the gateway.',
      status: 'invalidated',
      elements: ['element-1'],
      threats: ['threat-1'],
    },
    {
      id: 'assumption-model',
      prose: 'This model is kept by hand.',
      status: 'unconfirmed',
      elements: [],
      threats: [],
    },
  ],
});

const migrated = currentSaerskrivenYaml(version1);

describe('saerskrivenYamlVersionsSchema', () => {
  it.each([
    ['stamped with a later version', { ...version1, formatVersion: 3 }],
    ['with no version', { ...version1, formatVersion: undefined }],
  ])('refuses a document %s at formatVersion', (_, document) => {
    const parsed = saerskrivenYamlVersionsSchema.safeParse(document);
    expect(parsed.error?.issues.map(({ path }) => path)).toEqual([
      ['formatVersion'],
    ]);
  });

  it.each([
    [
      'a version 1 threat whose text is not a string',
      { ...version1, threats: [{ ...version1.threats[0], mitigation: 7 }] },
      ['threats', 0, 'mitigation'],
    ],
    [
      'a version 2 assumption without its model link',
      {
        ...migrated.document,
        assumptions: [
          {
            ...migrated.document.assumptions[0],
            appliesToModel: undefined,
          },
        ],
      },
      ['assumptions', 0, 'appliesToModel'],
    ],
  ])('refuses %s at a path into its own version', (_, document, path) => {
    const parsed = saerskrivenYamlVersionsSchema.safeParse(document);
    expect(parsed.error?.issues.map((issue) => issue.path)).toEqual([path]);
  });
});

describe('the version 2 wire schema', () => {
  it('declares the keys of version 1, less the threat text and the assumption element links, and with the model link', () => {
    const version1Keys = declaredKeys(saerskrivenYamlWireSchema).filter(
      (key) => key !== 'threats.mitigation' && key !== 'assumptions.elements',
    );
    expect(new Set(declaredKeys(saerskrivenYamlV2WireSchema))).toEqual(
      new Set([...version1Keys, 'assumptions.appliesToModel']),
    );
  });
});

describe('currentSaerskrivenYaml', () => {
  it('gives a document the version 2 schema holds as it is', () => {
    expect(saerskrivenYamlV2WireSchema.parse(migrated.document)).toEqual(
      migrated.document,
    );
  });

  it('makes one record of each non-empty text, implemented on a mitigated threat and proposed on any other', () => {
    expect(migrated.document.mitigations).toEqual([
      version1.mitigations[0],
      expect.objectContaining({
        prose: 'Sign every request.',
        status: 'implemented',
        threats: ['threat-1'],
      }),
      expect.objectContaining({
        prose: 'Rotate the key.',
        status: 'proposed',
        threats: ['threat-2'],
      }),
    ]);
  });

  it('applies to the model only the assumption that links no threat, keeping every status and threat link', () => {
    expect(migrated.document.assumptions).toEqual([
      {
        id: 'assumption-linked',
        prose: 'Callers sit behind the gateway.',
        status: 'invalidated',
        threats: ['threat-1'],
        appliesToModel: false,
      },
      {
        id: 'assumption-model',
        prose: 'This model is kept by hand.',
        status: 'unconfirmed',
        threats: [],
        appliesToModel: true,
      },
    ]);
  });

  it('keeps every threat status', () => {
    expect(migrated.document.threats.map(({ status }) => status)).toEqual([
      'mitigated',
      'open',
      'accepted-risk',
    ]);
  });

  it('reports the dropped element links alone, once per assumption that held any', () => {
    expect(migrated.divergences).toEqual([
      expect.objectContaining({
        subject: { kind: 'assumption', id: 'assumption-linked' },
        reason: 'narrowed',
      }),
    ]);
  });

  it('hands back a version 2 document as it is, reporting nothing', () => {
    const document: SaerskrivenYamlV2Document = migrated.document;
    expect(currentSaerskrivenYaml(document)).toEqual({
      document,
      divergences: [],
    });
  });
});
