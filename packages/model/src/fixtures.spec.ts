import { decimalsOf } from './fixtures.js';

describe('decimalsOf', () => {
  it.each([
    [128.6, 1],
    [-0.125, 3],
    [40, 0],
    [1e-7, 7],
    [1.5e-7, 8],
    [1.5e21, 0],
  ])('counts the decimals %d is written with as %d', (value, decimals) => {
    expect(decimalsOf(value)).toBe(decimals);
  });
});
