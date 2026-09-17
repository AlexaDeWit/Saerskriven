import type {
  SaerskrivenYamlDocument,
  SaerskrivenYamlThreat,
} from '@saerskriven/wire-saerskriven-yaml';
import { withMitigationTextAsRecords } from './saerskriven-yaml-migration-mitigation-text.js';
import { version1Document } from './saerskriven-yaml.fixtures.js';

const threat = (
  id: string,
  number: number,
  mitigation: string,
): SaerskrivenYamlThreat => ({
  id,
  number,
  title: 'Replayed webhook',
  category: { methodology: 'STRIDE', category: 'spoofing' },
  severity: 'high',
  status: 'mitigated',
  description: '',
  mitigation,
  elements: [],
});

const document = version1Document({
  threats: [
    threat('threat-2', 2, 'Sign the payload.'),
    threat('threat-1', 1, ''),
  ],
  lastIssuedThreatNumber: 2,
  mitigations: [
    {
      id: 'mitigation-held',
      title: 'Held',
      prose: '',
      status: 'verified',
      threats: ['threat-1'],
    },
  ],
});

const idOfTextRecord = (holding: SaerskrivenYamlDocument) =>
  withMitigationTextAsRecords(holding).mitigations.at(-1)?.id;

describe('withMitigationTextAsRecords', () => {
  it('counts past the id the rule would choose where an assumption holds it', () => {
    expect(
      idOfTextRecord({
        ...document,
        assumptions: [
          {
            id: 'threat-2-mitigation',
            prose: 'The payload is signed upstream.',
            status: 'valid',
            elements: [],
            threats: ['threat-2'],
          },
        ],
      }),
    ).toBe('threat-2-mitigation-2');
  });

  it('counts past the id the rule would choose where an element holds it', () => {
    expect(
      idOfTextRecord({
        ...document,
        diagrams: [
          {
            id: 'diagram-1',
            title: 'Only',
            elements: [
              {
                kind: 'process',
                id: 'threat-2-mitigation',
                name: 'Signer',
                description: '',
                outOfScope: false,
                reasonOutOfScope: '',
                position: { x: 0, y: 0 },
                size: { width: 10, height: 10 },
              },
            ],
          },
        ],
      }),
    ).toBe('threat-2-mitigation-2');
  });

  it('changes nothing in a document whose threats hold no text', () => {
    const migrated = withMitigationTextAsRecords(document);
    expect(withMitigationTextAsRecords(migrated)).toEqual(migrated);
  });
});
