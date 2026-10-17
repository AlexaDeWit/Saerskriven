import { diagramId, elementId, sharedModel } from '@saerskriven/model/fixtures';
import { otherDiagrams } from './other-diagrams.js';

const overview = diagramId('overview');

const elsewhere = (id: string): string[] =>
  otherDiagrams(sharedModel, elementId(id), overview).map(({ id: on }) => on);

describe('the other diagrams of an element', () => {
  it('name the diagrams other than the one on screen for each element two diagrams place, and none for an element on one', () => {
    for (const shared of [
      'payments-zone',
      'payments-api',
      'legend',
      'charge',
    ]) {
      expect(elsewhere(shared)).toEqual(['payments']);
    }
    expect(elsewhere('customer')).toEqual([]);
  });
});
