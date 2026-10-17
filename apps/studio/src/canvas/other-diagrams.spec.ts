import { diagramId, elementId, sharedModel } from '@saerskriven/model/fixtures';
import { otherDiagrams, sharedElementIds } from './other-diagrams.js';

describe('elements on more than one diagram', () => {
  it('are the ones two diagrams place, worked out once for the same diagrams', () => {
    const shared = sharedElementIds(sharedModel.diagrams);

    expect(shared).toEqual(
      new Set(['payments-zone', 'payments-api', 'legend', 'charge']),
    );
    expect(sharedElementIds(sharedModel.diagrams)).toBe(shared);
  });

  it('name the diagrams other than the one on screen, and an element on one names none', () => {
    expect(
      otherDiagrams(
        sharedModel,
        elementId('payments-api'),
        diagramId('overview'),
      ).map(({ id }) => id),
    ).toEqual(['payments']);
    expect(
      otherDiagrams(sharedModel, elementId('customer'), diagramId('overview')),
    ).toEqual([]);
  });
});
