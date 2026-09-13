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

  it('changes nothing in a document whose threats hold no text', () => {
    const migrated = withMitigationTextAsRecords(document);
    expect(withMitigationTextAsRecords(migrated)).toEqual(migrated);
  });
});
