import { z } from 'zod';
import {
  drawnActorSchema,
  elementBaseSchema,
  drawnFlowSchema,
  drawnProcessSchema,
  drawnStoreSchema,
  drawnTextSchema,
  drawnTrustBoundarySchema,
} from './drawn-elements.js';
import { elementIdSchema } from './ids.js';

const nodeGeometry = { accent: true, position: true, size: true } as const;

/** External actor. Security facts remain unknown when absent. */
export const actorSchema = drawnActorSchema.omit(nodeGeometry);

/** Actor element. */
export type Actor = z.infer<typeof actorSchema>;

/** Process security facts remain unknown when absent. */
export const processSchema = drawnProcessSchema.omit(nodeGeometry);

/** Process element. */
export type Process = z.infer<typeof processSchema>;

/** Data at rest. Security facts remain unknown when absent. */
export const storeSchema = drawnStoreSchema.omit(nodeGeometry);

/** Store element. */
export type Store = z.infer<typeof storeSchema>;

/** Canvas note with separate content and outline name. */
export const textSchema = drawnTextSchema.omit(nodeGeometry);

/** Canvas text element. */
export type TextElement = z.infer<typeof textSchema>;

/**
 * An endpoint attached to an element, or free. Where a free end sits, and
 * the side an attached end is pinned to, are each diagram's to say.
 */
export const flowEndpointSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('attached'), element: elementIdSchema }),
  z.object({ kind: z.literal('free') }),
]);

/** Flow endpoint. */
export type FlowEndpoint = z.infer<typeof flowEndpointSchema>;

/** Flow endpoint as {@link flowEndpointSchema} accepts it. */
export type FlowEndpointInput = z.input<typeof flowEndpointSchema>;

/** Flow direction is required. Absent security facts and relationship lists remain unknown. */
export const flowSchema = drawnFlowSchema
  .omit({ accent: true, waypoints: true })
  .extend({ source: flowEndpointSchema, target: flowEndpointSchema });

/** Flow element. */
export type Flow = z.infer<typeof flowSchema>;

/** Flow element as {@link flowSchema} accepts it. */
export type FlowInput = z.input<typeof flowSchema>;

/** Declared relationships are independent of geometry and remain unknown when absent. */
export const trustBoundarySchema = drawnTrustBoundarySchema.omit({
  accent: true,
  shape: true,
});

/** Trust boundary element. */
export type TrustBoundary = z.infer<typeof trustBoundarySchema>;

/** Trust boundary element as {@link trustBoundarySchema} accepts it. */
export type TrustBoundaryInput = z.input<typeof trustBoundarySchema>;

/**
 * One element of the model, stored once at its root: its identity, its
 * facts and its relationships. Where and how it is drawn is each diagram's
 * placement of it. Element-specific security facts are optional, and a
 * canvas note carries none, though a threat attaches to a note as to any
 * other kind.
 */
export const elementSchema = z.discriminatedUnion('kind', [
  actorSchema,
  processSchema,
  storeSchema,
  flowSchema,
  trustBoundarySchema,
  textSchema,
]);

/** Any element. */
export type Element = z.infer<typeof elementSchema>;

/** Any element as {@link elementSchema} accepts it. */
export type ElementInput = z.input<typeof elementSchema>;

/** The `kind` an element carries: {@link elementSchema}'s own discriminators. */
export const elementKindSchema = z.enum([
  'actor',
  'process',
  'store',
  'flow',
  'trust-boundary',
  'text',
]);

/** An element's kind. */
export type ElementKind = z.infer<typeof elementKindSchema>;

/**
 * A change to an element's description and scope: the fields it names
 * replace the held ones. The name has its own operation, which refuses an
 * empty one.
 */
export const elementDetailsChangeSchema = elementBaseSchema
  .pick({ description: true, outOfScope: true, reasonOutOfScope: true })
  .partial();

/** A change to an element's description and scope. */
export type ElementDetailsChange = z.infer<typeof elementDetailsChangeSchema>;
