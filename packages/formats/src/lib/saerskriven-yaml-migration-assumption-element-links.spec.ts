import { assumptionId } from '@saerskriven/model/fixtures';
import {
  droppedAssumptionElementLinks,
  withoutAssumptionElementLinks,
} from './saerskriven-yaml-migration-assumption-element-links.js';
import { version1Document } from './saerskriven-yaml.fixtures.js';

const assumption = (id: string, elements: string[]) => ({
  id,
  prose: 'The ledger is append only.',
  status: 'valid' as const,
  elements,
  threats: ['threat-1'],
});

const document = version1Document({
  assumptions: [
    assumption('assumption-linked', ['element-1', 'element-2']),
    assumption('assumption-unlinked', []),
    assumption('a', ['element-1']),
  ],
});

describe('droppedAssumptionElementLinks', () => {
  it('names each assumption that held element links, from the document alone, and skips one whose id the model refuses', () => {
    expect(droppedAssumptionElementLinks(document)).toEqual([
      expect.objectContaining({
        subject: {
          kind: 'assumption',
          id: assumptionId('assumption-linked'),
        },
        reason: 'narrowed',
      }),
    ]);
  });
});

describe('withoutAssumptionElementLinks', () => {
  it('empties every element list and keeps the threat links', () => {
    expect(
      withoutAssumptionElementLinks(document).assumptions.map(
        ({ elements, threats }) => ({ elements, threats }),
      ),
    ).toEqual(
      document.assumptions.map(() => ({ elements: [], threats: ['threat-1'] })),
    );
  });
});
