import {
  decimalsOf,
  fixedNumber,
  storedNumber,
  storedPoint,
  storedPoints,
  storedSize,
} from './decimals.js';

describe('decimalsOf', () => {
  it.each([
    [128.6, 1],
    [-0.125, 3],
    [40, 0],
    [1e-7, 7],
    [1.5e-7, 8],
    [1.5e21, 0],
    [1e-100, 100],
  ])('counts the decimals %d is written with as %d', (value, decimals) => {
    expect(decimalsOf(value)).toBe(decimals);
    expect(storedNumber(value, decimals)).toBe(value);
  });

  it('counts no more than the hundred decimals a count can name', () => {
    expect(decimalsOf(1e-101)).toBe(100);
    expect(decimalsOf(5e-324)).toBe(100);
  });
});

describe('fixedNumber', () => {
  it.each([
    [128.63636363636363, 1, '128.6'],
    [-12.25, 1, '-12.3'],
    [-0.04, 1, '0'],
    [119.98765, 0, '120'],
    [0.1 + 0.2, 5, '0.3'],
  ])('writes %d at %d decimals as %s', (value, decimals, written) => {
    expect(fixedNumber(value, decimals)).toBe(written);
  });

  it.each([
    [-3, '1'],
    [1.9, '1.3'],
    [1000, '1.25'],
    [Number.NaN, '1'],
  ])(
    'holds a count of %d to the range it takes, and throws for none',
    (decimals, written) => {
      expect(fixedNumber(1.25, decimals)).toBe(written);
    },
  );
});

describe('storedNumber', () => {
  it.each([
    [0.1 + 0.2, 0.3, 0.3],
    [123.63636363636364 + 5, 128.636, 128.6],
    [128.60000000000002, 128.6, 128.6],
    [5.1 - 5, 0.1, 0.1],
    [17.3 - 20, -2.7, -2.7],
    [-12.25, -12.25, -12.3],
    [-0.04, -0.04, 0],
    [-0.0004, 0, 0],
    [28.5, 28.5, 28.5],
    [33.123, 33.123, 33.1],
    [-275, -275, -275],
  ])(
    'stores %d as %d at three decimals and as %d at one',
    (value, three, one) => {
      expect(storedNumber(value, 3)).toBe(three);
      expect(storedNumber(value, 1)).toBe(one);
    },
  );

  it.each([0, 1, 3])(
    'gives a number arithmetic made no more than %d decimals, and the nearest such number',
    (decimals) => {
      for (let step = -400; step <= 400; step += 1) {
        for (const made of [
          step / 7,
          step / 11 + 5,
          step * 0.1 + 0.2,
          step * 1.1 - 20,
        ]) {
          const kept = storedNumber(made, decimals);
          expect(decimalsOf(kept)).toBeLessThanOrEqual(decimals);
          expect(Math.abs(kept - made)).toBeLessThanOrEqual(
            0.5 / 10 ** decimals + 1e-9,
          );
          expect(Object.is(kept, -0)).toBe(false);
        }
      }
    },
  );

  it('stores a number as it is where no count is named', () => {
    expect(storedNumber(128.60000000000002, undefined)).toBe(
      128.60000000000002,
    );
  });
});

describe('storedPoint, storedPoints and storedSize', () => {
  const point = { x: 123.63636363636364, y: -0.04 };
  const size = { width: 120.123456, height: 0.04 };

  it('store a copy, rounded where a count is named and as given where none is', () => {
    expect(storedPoint(point, 1)).toEqual({ x: 123.6, y: 0 });
    expect(storedPoints([point, point], 3)).toEqual([
      { x: 123.636, y: -0.04 },
      { x: 123.636, y: -0.04 },
    ]);
    expect(storedPoint(point, undefined)).toEqual(point);
    expect(storedPoint(point, undefined)).not.toBe(point);
    expect(storedSize(size, undefined)).toEqual(size);
    expect(storedSize(size, undefined)).not.toBe(size);
  });

  it.each([
    [3, { width: 120.123, height: 0.04 }],
    [1, { width: 120.1, height: 0.1 }],
    [0, { width: 120, height: 1 }],
  ])(
    'keeps a size at %d decimals above zero, at the smallest extent that count writes',
    (decimals, stored) => {
      expect(storedSize(size, decimals)).toEqual(stored);
    },
  );

  it('floors a size at 30 decimals on the smallest extent that count writes, with no noise of its own', () => {
    const least = storedSize({ width: 1e-200, height: 1 }, 30).width;

    expect(least).toBe(1e-30);
    expect(decimalsOf(least)).toBe(30);
  });
});
