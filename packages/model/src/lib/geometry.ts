import { z } from 'zod';

/**
 * Inclusive bounds in canvas units: coordinates from `-bound` to `bound`,
 * widths and heights from `leastExtent` to `bound`. Schemas refuse values
 * outside these ranges without clamping.
 */
export const geometryLimits = Object.freeze({
  /** Maximum coordinate magnitude, width and height. */
  bound: 1_000_000,
  /** Minimum width and height, below the studio's resize floor. */
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
 * Canvas location within {@link geometryLimits}. The origin is a reference
 * point, so coordinates may be negative.
 */
export const pointSchema = z.object({
  x: coordinateSchema,
  y: coordinateSchema,
});

/** Canvas location. */
export type Point = z.infer<typeof pointSchema>;

/**
 * Canvas width and height within {@link geometryLimits}.
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
