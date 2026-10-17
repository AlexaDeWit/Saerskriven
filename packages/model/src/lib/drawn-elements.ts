import { z } from 'zod';
import { elementBaseSchema } from './element-base.js';
import {
  actorSchema,
  flowSchema,
  processSchema,
  storeSchema,
  textSchema,
  trustBoundarySchema,
} from './elements.js';
import { pointSchema, sideSchema, waypointsSchema } from './geometry.js';
import { elementIdSchema } from './ids.js';
import {
  accentSchema,
  boundaryShapeSchema,
  nodePlacementSchema,
} from './placements.js';

const accentedBaseSchema = elementBaseSchema.extend({
  accent: accentSchema.optional(),
});

const nodeBaseSchema = accentedBaseSchema.extend(
  nodePlacementSchema.pick({ position: true, size: true }).shape,
);

/** An actor as one diagram draws it. Security facts remain unknown when absent. */
export const drawnActorSchema = nodeBaseSchema.extend(actorSchema.shape);

/** An actor as one diagram draws it. */
export type DrawnActor = z.infer<typeof drawnActorSchema>;

/** A process as one diagram draws it. Security facts remain unknown when absent. */
export const drawnProcessSchema = nodeBaseSchema.extend(processSchema.shape);

/** A process as one diagram draws it. */
export type DrawnProcess = z.infer<typeof drawnProcessSchema>;

/** A store as one diagram draws it. Security facts remain unknown when absent. */
export const drawnStoreSchema = nodeBaseSchema.extend(storeSchema.shape);

/** A store as one diagram draws it. */
export type DrawnStore = z.infer<typeof drawnStoreSchema>;

/** A canvas note as one diagram draws it. */
export const drawnTextSchema = nodeBaseSchema.extend(textSchema.shape);

/** A canvas note as one diagram draws it. */
export type DrawnText = z.infer<typeof drawnTextSchema>;

/**
 * A flow end as one diagram draws it: attached to an element the diagram
 * places, where an absent `side` leaves the side to the renderer, free at a
 * canvas position, or `away`, attached to an element the diagram does not
 * place and drawn at a canvas position.
 */
export const drawnFlowEndpointSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('attached'),
    element: elementIdSchema,
    side: sideSchema.optional(),
  }),
  z.object({
    kind: z.literal('free'),
    position: pointSchema,
  }),
  z.object({
    kind: z.literal('away'),
    element: elementIdSchema,
    position: pointSchema,
  }),
]);

/** A flow end as one diagram draws it. */
export type DrawnFlowEndpoint = z.infer<typeof drawnFlowEndpointSchema>;

/** A flow end as {@link drawnFlowEndpointSchema} accepts it. */
export type DrawnFlowEndpointInput = z.input<typeof drawnFlowEndpointSchema>;

/**
 * A flow as one diagram draws it. Absent security facts and relationship
 * lists remain unknown. Its keys run in the order a version 2 file holds a
 * flow's, its bends after its ends and before its direction.
 */
export const drawnFlowSchema = accentedBaseSchema
  .extend(flowSchema.omit({ bidirectional: true }).shape)
  .extend({
    source: drawnFlowEndpointSchema,
    target: drawnFlowEndpointSchema,
    waypoints: waypointsSchema,
  })
  .extend(flowSchema.pick({ bidirectional: true }).shape);

/** A flow as one diagram draws it. */
export type DrawnFlow = z.infer<typeof drawnFlowSchema>;

/** A flow as {@link drawnFlowSchema} accepts it. */
export type DrawnFlowInput = z.input<typeof drawnFlowSchema>;

/** A trust boundary as one diagram draws it. Declared relationships are independent of its shape. */
export const drawnTrustBoundarySchema = accentedBaseSchema
  .extend(trustBoundarySchema.shape)
  .extend({ shape: boundaryShapeSchema });

/** A trust boundary as one diagram draws it. */
export type DrawnTrustBoundary = z.infer<typeof drawnTrustBoundarySchema>;

/** A trust boundary as {@link drawnTrustBoundarySchema} accepts it. */
export type DrawnTrustBoundaryInput = z.input<typeof drawnTrustBoundarySchema>;

/**
 * An element as one diagram draws it: the element's facts, with that
 * diagram's placement inline, its accent and geometry, and each flow end's
 * pinned side or position folded into the end. It is the shape a reader of a
 * diagram takes, and the shape a version 2 file holds a diagram's elements in.
 */
export const drawnElementSchema = z.discriminatedUnion('kind', [
  drawnActorSchema,
  drawnProcessSchema,
  drawnStoreSchema,
  drawnFlowSchema,
  drawnTrustBoundarySchema,
  drawnTextSchema,
]);

/** An element as one diagram draws it. */
export type DrawnElement = z.infer<typeof drawnElementSchema>;

/** An element as {@link drawnElementSchema} accepts it. */
export type DrawnElementInput = z.input<typeof drawnElementSchema>;
