import type { Model } from '@saerskriven/model';
import {
  assumptionOf,
  mitigationOf,
  modelFrom,
  threatOf,
} from '@saerskriven/model/fixtures';
import {
  badgesIn,
  modelSectionIn,
  recordItems,
  scopedAssumptionsModel,
  sectionItems,
  textOf,
  threatSectionsIn,
} from './register-tree.fixtures.js';
import { registerDocument } from './register-tree.js';

const flagsBySection = (model: Model) =>
  threatSectionsIn(registerDocument(model, 'en-CA')).map((section) =>
    badgesIn(section).filter((badge) => badge.kind === 'flag'),
  );

describe('registerDocument', () => {
  describe('the assumptions that apply to the model', () => {
    const model = scopedAssumptionsModel;

    it('also list under a threat they link, and leave out an assumption that does not apply to the model', () => {
      const tree = registerDocument(model, 'en-CA');
      expect(
        sectionItems(modelSectionIn(tree)).map((item) =>
          textOf(item.children.slice(1)),
        ),
      ).toEqual(['model only', 'model and threat']);
      expect(
        threatSectionsIn(tree).map((section) =>
          recordItems(section, 'Assumptions').map((item) =>
            textOf(item.children.slice(1)),
          ),
        ),
      ).toEqual([['threat only', 'model and threat'], []]);
    });

    it('carry no flag, and raise none on a threat', () => {
      const tree = registerDocument(model, 'en-CA');
      expect(
        badgesIn(modelSectionIn(tree)).filter((badge) => badge.kind === 'flag'),
      ).toEqual([]);
      expect(
        badgesIn(tree.children).filter((badge) => badge.kind === 'flag'),
      ).toEqual([]);
    });
  });

  describe("a threat's flags", () => {
    it('carries a badge for each flag the model derives, and none where there is none', () => {
      const model = modelFrom({
        threats: [
          threatOf({ number: 1, status: 'mitigated' }),
          threatOf({ number: 2 }),
          threatOf({ number: 3, status: 'mitigated' }),
        ],
        mitigations: [
          mitigationOf({
            id: 'mitigation-a',
            threats: ['threat-3'],
            status: 'implemented',
          }),
        ],
        assumptions: [
          assumptionOf({
            id: 'assumption-a',
            threats: ['threat-1', 'threat-3'],
            status: 'invalidated',
          }),
        ],
      });
      expect(flagsBySection(model)).toEqual([
        [
          { kind: 'flag', value: 'mitigated-without-implemented-work' },
          { kind: 'flag', value: 'rests-on-invalidated-assumption' },
        ],
        [],
        [{ kind: 'flag', value: 'rests-on-invalidated-assumption' }],
      ]);
    });
  });
});
