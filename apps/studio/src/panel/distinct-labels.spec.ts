import { distinctLabels, optionName } from './distinct-labels.js';

describe('distinctLabels', () => {
  it('keeps a unique name as it is', () => {
    expect(
      distinctLabels([
        { id: 'a1', label: 'Ledger', unnamed: false },
        { id: 'b2', label: 'Queue', unnamed: false },
      ]),
    ).toEqual(
      new Map([
        ['a1', { label: 'Ledger' }],
        ['b2', { label: 'Queue' }],
      ]),
    );
  });

  it('adds the id to a repeated name and to a stand-in name', () => {
    const labels = distinctLabels([
      { id: 'a1', label: 'Ledger', unnamed: false },
      { id: 'b2', label: 'Ledger', unnamed: false },
      { id: 'c3', label: 'the store', unnamed: true },
    ]);
    expect(labels.get('a1')?.suffix).toContain('a1');
    expect(labels.get('b2')?.suffix).toContain('b2');
    expect(labels.get('c3')?.suffix).toContain('c3');
    expect(labels.get('a1')?.label).toBe('Ledger');
  });

  it('numbers every label where they still collide once normalized', () => {
    const labels = distinctLabels([
      { id: 'a1', label: 'Ledger (b2)', unnamed: false },
      { id: 'b2', label: 'Ledger', unnamed: true },
    ]);
    expect(new Set([...labels.values()].map(optionName)).size).toBe(2);
    expect(labels.get('a1')?.label).toMatch(/^1\b/u);
    expect(labels.get('b2')?.label).toMatch(/^2\b/u);
  });
});
