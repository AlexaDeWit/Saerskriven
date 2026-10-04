import { autoPlacement, pointSchema, sizeSchema } from './geometry.js';

describe('pointSchema', () => {
  it('accepts negative and fractional coordinates', () => {
    expect(pointSchema.parse({ x: -3.5, y: 860 })).toEqual({ x: -3.5, y: 860 });
  });

  it('holds a coordinate from -1,000,000 to 1,000,000, both ends included', () => {
    expect(pointSchema.safeParse({ x: -1_000_000, y: 1_000_000 }).success).toBe(
      true,
    );
    expect(pointSchema.safeParse({ x: -1_000_000.001, y: 0 }).success).toBe(
      false,
    );
    expect(pointSchema.safeParse({ x: 0, y: 1_000_000.001 }).success).toBe(
      false,
    );
  });
});

describe('sizeSchema', () => {
  it('holds a width or a height from 1 to 1,000,000, both ends included', () => {
    expect(sizeSchema.safeParse({ width: 1, height: 1_000_000 }).success).toBe(
      true,
    );
    expect(sizeSchema.safeParse({ width: 0.999, height: 90 }).success).toBe(
      false,
    );
    expect(
      sizeSchema.safeParse({ width: 170, height: 1_000_000.001 }).success,
    ).toBe(false);
  });
});

describe('autoPlacement', () => {
  it('fills four columns before it starts a row', () => {
    expect([0, 1, 2, 3, 4].map(autoPlacement)).toEqual([
      { x: 60, y: 60 },
      { x: 320, y: 60 },
      { x: 580, y: 60 },
      { x: 840, y: 60 },
      { x: 60, y: 220 },
    ]);
  });
});
