import { inShownOrder } from './shown-order.js';

describe('inShownOrder', () => {
  it('keeps shown rows in their shown order, holds the slot of a gone row, and puts new rows after them', () => {
    const rows = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

    expect(inShownOrder(rows, ['c', 'gone', 'a', 'c'])).toEqual({
      rows: ['c', 'a', 'b', 'd'].map((id) => ({ id })),
      shown: ['c', 'gone', 'a', 'b', 'd'],
    });
  });

  it('gives back the shown order itself when no row is new', () => {
    const shown = ['b', 'gone', 'a'];

    expect(inShownOrder([{ id: 'a' }, { id: 'b' }], shown).shown).toBe(shown);
  });
});
