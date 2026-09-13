import type {
  SaerskrivenYamlDocument,
  SaerskrivenYamlThreat,
} from '@saerskriven/wire-saerskriven-yaml';
import { withMitigationTextAsRecords } from './threat-mitigation-text.js';

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

const document: SaerskrivenYamlDocument = {
  formatVersion: 1,
  metadata: { title: 'Texts', owner: '', description: '', contributors: [] },
  diagrams: [],
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
  assumptions: [],
};

const idOfTextRecord = (holding: SaerskrivenYamlDocument) =>
  withMitigationTextAsRecords(holding).mitigations.at(-1)?.id;

describe('withMitigationTextAsRecords', () => {
  it('empties every text and adds its records after the ones the document holds', () => {
    const migrated = withMitigationTextAsRecords(document);
    expect(migrated.threats.map(({ mitigation }) => mitigation)).toEqual([
      '',
      '',
    ]);
    expect(migrated.mitigations).toEqual([
      document.mitigations[0],
      {
        id: 'threat-2-mitigation',
        title: '',
        prose: 'Sign the payload.',
        status: 'implemented',
        threats: ['threat-2'],
      },
    ]);
  });

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
