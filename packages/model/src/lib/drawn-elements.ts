import { z } from 'zod';
import { pointSchema, sideSchema, waypointsSchema } from './geometry.js';
import { elementIdSchema } from './ids.js';
import {
  accentSchema,
  boundaryShapeSchema,
  nodePlacementSchema,
} from './placements.js';
import { acceptedTextSchema } from './text.js';

/** The facts every element holds, whatever its kind. */
export const elementBaseSchema = z.object({
  id: elementIdSchema,
  name: acceptedTextSchema,
  description: acceptedTextSchema,
  outOfScope: z.boolean(),
  reasonOutOfScope: acceptedTextSchema,
});

const accentedBaseSchema = elementBaseSchema.extend({
  accent: accentSchema.optional(),
});

const nodeGeometrySchema = nodePlacementSchema.pick({
  position: true,
  size: true,
});

const nodeBaseSchema = accentedBaseSchema.extend(nodeGeometrySchema.shape);

/** An actor as one diagram draws it. Security facts remain unknown when absent. */
export const drawnActorSchema = nodeBaseSchema.extend({
  kind: z.literal('actor'),
  providesAuthentication: z.boolean().optional(),
});

/** An actor as one diagram draws it. */
export type DrawnActor = z.infer<typeof drawnActorSchema>;

/** A process as one diagram draws it. Security facts remain unknown when absent. */
export const drawnProcessSchema = nodeBaseSchema.extend({
  kind: z.literal('process'),
  handlesCardPayment: z.boolean().optional(),
  handlesGoodsOrServices: z.boolean().optional(),
  isWebApplication: z.boolean().optional(),
  privilegeLevel: acceptedTextSchema.optional(),
});

/** A process as one diagram draws it. */
export type DrawnProcess = z.infer<typeof drawnProcessSchema>;

/** A store as one diagram draws it. Security facts remain unknown when absent. */
export const drawnStoreSchema = nodeBaseSchema.extend({
  kind: z.literal('store'),
  isALog: z.boolean().optional(),
  isEncrypted: z.boolean().optional(),
  isSigned: z.boolean().optional(),
  storesCredentials: z.boolean().optional(),
  storesInventory: z.boolean().optional(),
});

/** A store as one diagram draws it. */
export type DrawnStore = z.infer<typeof drawnStoreSchema>;

/** A canvas note as one diagram draws it. */
export const drawnTextSchema = nodeBaseSchema.extend({
  kind: z.literal('text'),
  text: acceptedTextSchema,
});

/** A canvas note as one diagram draws it. */
export type DrawnText = z.infer<typeof drawnTextSchema>;

/**
 * A flow end as one diagram draws it: attached to an element, where an absent
 * `side` leaves the side to the renderer, or free at a canvas position.
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
]);

/** A flow end as one diagram draws it. */
export type DrawnFlowEndpoint = z.infer<typeof drawnFlowEndpointSchema>;

/** A flow end as {@link drawnFlowEndpointSchema} accepts it. */
export type DrawnFlowEndpointInput = z.input<typeof drawnFlowEndpointSchema>;

/** A flow as one diagram draws it. Absent security facts and relationship lists remain unknown. */
export const drawnFlowSchema = accentedBaseSchema.extend({
  kind: z.literal('flow'),
  protocol: acceptedTextSchema.optional(),
  isEncrypted: z.boolean().optional(),
  isPublicNetwork: z.boolean().optional(),
  trustBoundaryIds: z.array(elementIdSchema).optional(),
  source: drawnFlowEndpointSchema,
  target: drawnFlowEndpointSchema,
  waypoints: waypointsSchema,
  bidirectional: z.boolean(),
});

/** A flow as one diagram draws it. */
export type DrawnFlow = z.infer<typeof drawnFlowSchema>;

/** A flow as {@link drawnFlowSchema} accepts it. */
export type DrawnFlowInput = z.input<typeof drawnFlowSchema>;

/** A trust boundary as one diagram draws it. Declared relationships are independent of its shape. */
export const drawnTrustBoundarySchema = accentedBaseSchema.extend({
  kind: z.literal('trust-boundary'),
  containedElements: z.array(elementIdSchema).optional(),
  crossingFlows: z.array(elementIdSchema).optional(),
  shape: boundaryShapeSchema,
});

/** A trust boundary as one diagram draws it. */
export type DrawnTrustBoundary = z.infer<typeof drawnTrustBoundarySchema>;

/** A trust boundary as {@link drawnTrustBoundarySchema} accepts it. */
export type DrawnTrustBoundaryInput = z.input<typeof drawnTrustBoundarySchema>;

/**
 * An element as one diagram draws it: the element's facts, with that
 * diagram's placement inline, its accent and geometry, and each flow end's
 * pinned side or position folded into the end. It is the shape a reader of a
 * diagram takes, and the shape a diagram held before elements moved to the
 * model's root.
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
