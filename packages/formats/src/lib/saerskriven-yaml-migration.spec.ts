import { saerskrivenYamlWireSchema } from '@saerskriven/wire-saerskriven-yaml';
import { saerskrivenYamlV2WireSchema } from '@saerskriven/wire-saerskriven-yaml-v2';
import {
  saerskrivenYamlV3WireSchema,
  type SaerskrivenYamlV3Document,
} from '@saerskriven/wire-saerskriven-yaml-v3';
import type { SaerskrivenYamlThreat } from '@saerskriven/wire-saerskriven-yaml';
import { parse } from 'yaml';
import type { canonicalOrder } from './canonical-order.js';
import { currentSaerskrivenYaml } from './saerskriven-yaml-migration.js';
import {
  featureCompleteV3Yaml,
  featureCompleteYaml,
  version1Document,
} from './saerskriven-yaml.fixtures.js';

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

const threat = (
  id: string,
  number: number,
  status: SaerskrivenYamlThreat['status'],
  text: string,
): SaerskrivenYamlThreat => ({
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

const version1 = version1Document({
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

describe('the version 2 wire schema', () => {
  it('declares the keys of version 1, less the threat text and the assumption element links, and with the model link of an assumption and, optionally, the model link of a threat and the accent of an element', () => {
    const version1Keys = declaredKeys(saerskrivenYamlWireSchema).filter(
      (key) => key !== 'threats.mitigation' && key !== 'assumptions.elements',
    );
    expect(new Set(declaredKeys(saerskrivenYamlV2WireSchema))).toEqual(
      new Set([
        ...version1Keys,
        'assumptions.appliesToModel',
        'threats.appliesToModel?',
        'diagrams.elements.accent?',
      ]),
    );
  });
});

describe('currentSaerskrivenYaml', () => {
  it('gives a document the version 3 schema holds as it is', () => {
    expect(saerskrivenYamlV3WireSchema.parse(migrated.document)).toEqual(
      migrated.document,
    );
  });

  it('places each version 2 element on the diagram that drew it, keeping every id, order and value, its accent on its placement, and reports nothing', () => {
    expect(
      currentSaerskrivenYaml(
        saerskrivenYamlV2WireSchema.parse(parse(featureCompleteYaml)),
      ),
    ).toEqual({
      document: saerskrivenYamlV3WireSchema.parse(parse(featureCompleteV3Yaml)),
      divergences: [],
    });
  });

  it('carries an accent no release knows onto the placement as the file states it', () => {
    const document = saerskrivenYamlV2WireSchema.parse(
      parse(featureCompleteYaml.replace('accent: s1', 'accent: s9')),
    );
    expect(
      currentSaerskrivenYaml(document).document.diagrams[0].placements,
    ).toContainEqual(
      expect.objectContaining({ element: 'process-booking', accent: 's9' }),
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

  it('reports the dropped element links alone, once per assumption that held any', () => {
    expect(migrated.divergences).toEqual([
      expect.objectContaining({
        subject: { kind: 'assumption', id: 'assumption-linked' },
        reason: 'narrowed',
      }),
    ]);
  });

  it('hands back a version 3 document as it is, reporting nothing', () => {
    const document: SaerskrivenYamlV3Document = migrated.document;
    expect(currentSaerskrivenYaml(document)).toEqual({
      document,
      divergences: [],
    });
  });
});
