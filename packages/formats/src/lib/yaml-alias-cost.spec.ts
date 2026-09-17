import { parseDocument } from 'yaml';
import { adversarialText } from './corpus.fixtures.js';
import { aliasCostIn } from './yaml-alias-cost.js';

describe('aliasCostIn', () => {
  it('counts an alias and the aliases its anchor expands to', () => {
    const document = parseDocument(adversarialText('alias-expansion.yaml'));
    expect(
      aliasCostIn(document, { expanded: 1_000, reached: 1_000 }).expanded,
    ).toBe(54);
  });

  it('counts a mapping anchor by its keys and its values alike', () => {
    const document = parseDocument(
      'shared: &shared { a: 1, b: 2 }\nuse: [*shared, *shared]\n',
    );
    expect(
      aliasCostIn(document, { expanded: 1_000, reached: 1_000 }).reached,
    ).toBe(10);
  });
});
