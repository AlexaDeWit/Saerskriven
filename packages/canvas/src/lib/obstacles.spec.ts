import type { Point } from '@saerskriven/model';
import { boxAt, modelWith } from '@saerskriven/model/fixtures';
import { layoutOf } from './canvas.fixtures.js';
import { boxesOverlap, type Box } from './geometry.js';
import { handlePositions, handleSides, nodeBox } from './handles.js';
import { boxCollisions, nodeOutline, processEllipse } from './obstacles.js';

const [process] = layoutOf(
  modelWith({
    elements: [
      boxAt('el-process', 40, 20, 'process', { width: 200, height: 100 }),
    ],
  }),
).nodes;

const pointBox = (point: Point): Box => ({
  minX: point.x,
  minY: point.y,
  maxX: point.x,
  maxY: point.y,
});

const towardCorner = (scale: number): Box =>
  pointBox({
    x: 40 + 100 + 100 * Math.SQRT1_2 * scale,
    y: 20 + 50 + 50 * Math.SQRT1_2 * scale,
  });

describe("a process's outline", () => {
  it('is the ellipse filling its box, a circle in a square one', () => {
    expect(processEllipse({ width: 200, height: 100 })).toEqual({
      centre: { x: 100, y: 50 },
      radiusX: 100,
      radiusY: 50,
    });
    expect(processEllipse({ width: 80, height: 80 })).toEqual({
      centre: { x: 40, y: 40 },
      radiusX: 40,
      radiusY: 40,
    });
  });

  it('charges a label for a point just inside the ellipse toward a corner', () => {
    expect(boxCollisions(towardCorner(0.98), nodeOutline(process))).toBe(1);
  });

  it('leaves a point just outside the ellipse, in the corner of its box, clear', () => {
    const corner = towardCorner(1.02);
    expect(boxesOverlap(corner, nodeBox(process))).toBe(true);
    expect(boxCollisions(corner, nodeOutline(process))).toBe(0);
  });

  it.each(handleSides)('meets the flow end on its %s side', (side) => {
    expect(
      boxCollisions(
        pointBox(handlePositions(process)[side]),
        nodeOutline(process),
      ),
    ).toBe(1);
  });
});
