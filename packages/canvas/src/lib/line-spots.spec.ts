import type { Point } from '@saerskriven/model';
import { lineRuns, runsWithin, spotsOutward } from './line-spots.js';

const bent: [Point, ...Point[]] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 20 },
];

describe('spotsOutward', () => {
  it('starts at the middle of the longest run', () => {
    const [start] = spotsOutward(lineRuns(bent), 4);
    expect(start.at).toEqual({ x: 10, y: 10 });
    expect(start.offset).toBe(0);
  });

  it('walks a step toward the source before the same step toward the target', () => {
    expect(
      spotsOutward(lineRuns(bent), 4)
        .slice(0, 5)
        .map((spot) => spot.offset),
    ).toEqual([0, -4, 4, -8, 8]);
  });

  it('follows the line round a bend', () => {
    const turned = spotsOutward(lineRuns(bent), 4).find(
      (spot) => spot.offset === -12,
    );
    expect(turned?.at).toEqual({ x: 8, y: 0 });
    expect(turned?.run).toBe(0);
    expect(turned?.along).toBe(8);
  });

  it('stops at both ends of the line', () => {
    const offsets = spotsOutward(lineRuns(bent), 4).map((spot) => spot.offset);
    expect(Math.min(...offsets)).toBe(-20);
    expect(Math.max(...offsets)).toBe(8);
  });

  it('gives a line of no length the one spot it stands at', () => {
    expect(
      spotsOutward(lineRuns([{ x: 3, y: 4 }]), 4).map((spot) => spot.at),
    ).toEqual([{ x: 3, y: 4 }]);
  });
});

describe('runsWithin', () => {
  it('cuts the first stretch of a line, round a bend', () => {
    expect(runsWithin(bent, 15)).toEqual([
      { from: { x: 0, y: 0 }, to: { x: 10, y: 0 } },
      { from: { x: 10, y: 0 }, to: { x: 10, y: 5 } },
    ]);
  });

  it('cuts the last stretch of a line from its end', () => {
    expect(runsWithin(bent, 5, true)).toEqual([
      { from: { x: 10, y: 20 }, to: { x: 10, y: 15 } },
    ]);
  });
});
