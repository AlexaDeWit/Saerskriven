import type { SaerskrivenYamlDocument } from '@saerskriven/wire-saerskriven-yaml';
import { assumptionsWithModelLinks } from './assumption-model-links.js';

const assumption = (id: string, threats: string[]) => ({
  id,
  prose: 'The ledger is append only.',
  status: 'valid' as const,
  elements: [],
  threats,
});

const document: SaerskrivenYamlDocument = {
  formatVersion: 1,
  metadata: { title: 'Linked', owner: '', description: '', contributors: [] },
  diagrams: [],
  threats: [],
  lastIssuedThreatNumber: 0,
  mitigations: [],
  assumptions: [
    assumption('assumption-threatless', []),
    assumption('assumption-linked', ['threat-1', 'threat-2']),
  ],
};

describe('assumptionsWithModelLinks', () => {
  it('applies an assumption that links no threat to the model, and keeps one that links threats on them alone', () => {
    expect(
      assumptionsWithModelLinks(document).map(
        ({ id, threats, appliesToModel }) => ({ id, threats, appliesToModel }),
      ),
    ).toEqual([
      { id: 'assumption-threatless', threats: [], appliesToModel: true },
      {
        id: 'assumption-linked',
        threats: ['threat-1', 'threat-2'],
        appliesToModel: false,
      },
    ]);
  });
});
