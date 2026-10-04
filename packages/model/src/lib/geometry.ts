import { z } from 'zod';

/**
 * The bounds of canvas geometry, in canvas units, both ends included. A
 * coordinate lies from `-bound` to `bound`, and a width or a height from
 * `leastExtent` to `bound`. The bound is about 3,800 columns of
 * {@link autoPlacement}'s grid, past any diagram a person draws, so a number
 * outside it is refused and never clamped. Inside it a layout that multiplies
 * two lengths at the most stays far inside what a double holds.
 */
export const geometryLimits = Object.freeze({
  /** The furthest a coordinate lies from the origin on either axis, and the greatest width or height. */
  bound: 1_000_000,
  /** The least width or height, under the ten units the studio resizes down to, so a small element a file states still reads. */
  leastExtent: 1,
});

const coordinateSchema = z
  .number()
  .min(-geometryLimits.bound)
  .max(geometryLimits.bound);

const extentSchema = z
  .number()
  .min(geometryLimits.leastExtent)
  .max(geometryLimits.bound);

/**
 * A location on the diagram canvas, in canvas units, each coordinate inside
 * {@link geometryLimits}. Coordinates may be negative: the origin is a
 * reference point, not an edge.
 */
export const pointSchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
});

/** Canvas location. */
export type Point = z.infer<typeof pointSchema>;

/**
 * Extent of an element on the canvas, in canvas units, each of width and
 * height inside {@link geometryLimits}: an element of no extent cannot be
 * drawn or picked.
 */
export const sizeSchema = z.object({
  width: extentSchema,
  height: extentSchema,
});

/** Canvas extent. */
export type Size = z.infer<typeof sizeSchema>;

/** The sides of a box, in the order a tie between them breaks. */
export const sides = ['top', 'right', 'bottom', 'left'] as const;

/**
 * One side of a box, where a flow endpoint attaches and where a resize
 * control sits.
 */
export const sideSchema = z.enum(sides);

/** Side of a box. */
export type Side = z.infer<typeof sideSchema>;

/**
 * Intermediate points a flow or boundary curve passes through, in drawing
 * order. On a flow, an empty list leaves the routing to the renderer.
 */
export const waypointsSchema = z.array(pointSchema);

const placementColumns = 4;
const placementMargin = 60;
const placementStep = { x: 260, y: 160 };

/** The extent of an element whose source states none, and the one {@link autoPlacement}'s grid is stepped for. */
export const autoExtent: Size = { width: 180, height: 80 };

/**
 * The position of the element at `index` in a run with no geometry: a
 * row-major grid of four columns from a fixed margin, the same spot for the
 * same index.
 */
export function autoPlacement(index: number): Point {
  return {
    x: placementMargin + (index % placementColumns) * placementStep.x,
    y: placementMargin + Math.floor(index / placementColumns) * placementStep.y,
  };
}
