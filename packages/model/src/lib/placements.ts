import { z } from 'zod';
import {
  pointSchema,
  sideSchema,
  sizeSchema,
  waypointsSchema,
} from './geometry.js';
import { elementIdSchema } from './ids.js';

/**
 * The keys a placement is accented by: a strength, `s` for strong or `l` for
 * light, and one of four palette slots. A key names no colour and carries no
 * meaning. Each palette decides how a slot is drawn.
 */
export const accentSchema = z.enum([
  's1',
  's2',
  's3',
  's4',
  'l1',
  'l2',
  'l3',
  'l4',
]);

/** An accent key. */
export type Accent = z.infer<typeof accentSchema>;

/** One of the four palette slots an accent key names. */
export type AccentSlot = 1 | 2 | 3 | 4;

/** The strength and the palette slot each accent key names. */
export const accentParts = {
  s1: { strong: true, slot: 1 },
  s2: { strong: true, slot: 2 },
  s3: { strong: true, slot: 3 },
  s4: { strong: true, slot: 4 },
  l1: { strong: false, slot: 1 },
  l2: { strong: false, slot: 2 },
  l3: { strong: false, slot: 3 },
  l4: { strong: false, slot: 4 },
} as const satisfies Record<
  Accent,
  { readonly strong: boolean; readonly slot: AccentSlot }
>;

/**
 * The accent of a placement, or of an element as a diagram draws it, as a
 * field to spread, and no field where it holds none.
 */
export function accentField(held: { readonly accent?: Accent | undefined }): {
  readonly accent?: Accent;
} {
  return held.accent === undefined ? {} : { accent: held.accent };
}

const boxBoundaryShapeSchema = z.object({
  kind: z.literal('box'),
  position: pointSchema,
  size: sizeSchema,
});

/** Box boundary shape. */
export type BoxBoundaryShape = z.infer<typeof boxBoundaryShapeSchema>;

const curveBoundaryShapeSchema = z.object({
  kind: z.literal('curve'),
  waypoints: waypointsSchema.min(2),
});

/** Curve boundary shape. */
export type CurveBoundaryShape = z.infer<typeof curveBoundaryShapeSchema>;

/** Trust boundary geometry: a box, or an open curve through at least two points. */
export const boundaryShapeSchema = z.discriminatedUnion('kind', [
  boxBoundaryShapeSchema,
  curveBoundaryShapeSchema,
]);

/** Trust boundary shape. */
export type BoundaryShape = z.infer<typeof boundaryShapeSchema>;

/** Trust boundary shape as {@link boundaryShapeSchema} accepts it. */
export type BoundaryShapeInput = z.input<typeof boundaryShapeSchema>;

const placementBaseSchema = z.object({
  element: elementIdSchema,
  accent: accentSchema.optional(),
});

/** Where an actor, a process, a store or a note sits on one diagram, and how large it is drawn there. */
export const nodePlacementSchema = placementBaseSchema.extend({
  position: pointSchema,
  size: sizeSchema,
});

/** An actor, process, store or note placement. */
export type NodePlacement = z.infer<typeof nodePlacementSchema>;

/** A trust boundary's shape on one diagram. */
export const boundaryPlacementSchema = placementBaseSchema.extend({
  shape: boundaryShapeSchema,
});

/** A trust boundary placement. */
export type BoundaryPlacement = z.infer<typeof boundaryPlacementSchema>;

/**
 * One end of a flow on one diagram. An end attached to an element placed on
 * that diagram holds no `position`, and its `side` pins it where one is
 * given. A free end holds its `position` and no `side`. parseModel enforces
 * both, so this schema alone accepts either key on any end.
 */
export const placedFlowEndSchema = z.object({
  side: sideSchema.optional(),
  position: pointSchema.optional(),
});

/** One end of a flow placement. */
export type PlacedFlowEnd = z.infer<typeof placedFlowEndSchema>;

/** A flow's route on one diagram: its bends, and how each end is drawn there. */
export const flowPlacementSchema = placementBaseSchema.extend({
  waypoints: waypointsSchema,
  source: placedFlowEndSchema,
  target: placedFlowEndSchema,
});

/** A flow placement. */
export type FlowPlacement = z.infer<typeof flowPlacementSchema>;

/**
 * One element drawn on one diagram: the element's id, the accent it takes
 * there, and its geometry there, told apart by the keys it holds. Which
 * geometry fits is the element's kind, which parseModel enforces, so this
 * schema alone accepts a placement of any shape for any element.
 */
export const placementSchema = z.union([
  nodePlacementSchema,
  boundaryPlacementSchema,
  flowPlacementSchema,
]);

/** A placement of an element on one diagram. */
export type Placement = z.infer<typeof placementSchema>;

/** A placement as {@link placementSchema} accepts it. */
export type PlacementInput = z.input<typeof placementSchema>;
