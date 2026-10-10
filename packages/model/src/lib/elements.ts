import { z } from 'zod';
import {
  pointSchema,
  sideSchema,
  sizeSchema,
  waypointsSchema,
} from './geometry.js';
import { elementIdSchema } from './ids.js';
import { acceptedTextSchema } from './text.js';

/**
 * The keys an element is accented by: a strength, `s` for strong or `l` for
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

const elementBaseSchema = z.object({
  id: elementIdSchema,
  name: acceptedTextSchema,
  description: acceptedTextSchema,
  outOfScope: z.boolean(),
  reasonOutOfScope: acceptedTextSchema,
});

const accentableBaseSchema = elementBaseSchema.extend({
  accent: accentSchema.optional(),
});

const nodeBaseSchema = accentableBaseSchema.extend({
  position: pointSchema,
  size: sizeSchema,
});

/** External actor. Security facts remain unknown when absent. */
export const actorSchema = nodeBaseSchema.extend({
  kind: z.literal('actor'),
  providesAuthentication: z.boolean().optional(),
});

/** Actor element. */
export type Actor = z.infer<typeof actorSchema>;

/** Process security facts remain unknown when absent. */
export const processSchema = nodeBaseSchema.extend({
  kind: z.literal('process'),
  handlesCardPayment: z.boolean().optional(),
  handlesGoodsOrServices: z.boolean().optional(),
  isWebApplication: z.boolean().optional(),
  privilegeLevel: acceptedTextSchema.optional(),
});

/** Process element. */
export type Process = z.infer<typeof processSchema>;

/** Data at rest. Security facts remain unknown when absent. */
export const storeSchema = nodeBaseSchema.extend({
  kind: z.literal('store'),
  isALog: z.boolean().optional(),
  isEncrypted: z.boolean().optional(),
  isSigned: z.boolean().optional(),
  storesCredentials: z.boolean().optional(),
  storesInventory: z.boolean().optional(),
});

/** Store element. */
export type Store = z.infer<typeof storeSchema>;

/** Canvas note with separate content and outline name. It takes no accent. */
export const textSchema = elementBaseSchema.extend({
  position: pointSchema,
  size: sizeSchema,
  kind: z.literal('text'),
  text: acceptedTextSchema,
});

/** Canvas text element. */
export type TextElement = z.infer<typeof textSchema>;

const attachedEndpointSchema = z.object({
  kind: z.literal('attached'),
  element: elementIdSchema,
  side: sideSchema.optional(),
});

const freeEndpointSchema = z.object({
  kind: z.literal('free'),
  position: pointSchema,
});

/**
 * An endpoint attached to an element, where an absent `side` leaves the side
 * to the renderer, or free at a canvas position.
 */
export const flowEndpointSchema = z.discriminatedUnion('kind', [
  attachedEndpointSchema,
  freeEndpointSchema,
]);

/** Flow endpoint. */
export type FlowEndpoint = z.infer<typeof flowEndpointSchema>;

/** Flow endpoint as {@link flowEndpointSchema} accepts it. */
export type FlowEndpointInput = z.input<typeof flowEndpointSchema>;

/** Flow direction is required. Absent security facts and relationship lists remain unknown. */
export const flowSchema = accentableBaseSchema.extend({
  kind: z.literal('flow'),
  protocol: acceptedTextSchema.optional(),
  isEncrypted: z.boolean().optional(),
  isPublicNetwork: z.boolean().optional(),
  trustBoundaryIds: z.array(elementIdSchema).optional(),
  source: flowEndpointSchema,
  target: flowEndpointSchema,
  waypoints: waypointsSchema,
  bidirectional: z.boolean(),
});

/** Flow element. */
export type Flow = z.infer<typeof flowSchema>;

/** Flow element as {@link flowSchema} accepts it. */
export type FlowInput = z.input<typeof flowSchema>;

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

/** Declared relationships are independent of geometry and remain unknown when absent. */
export const trustBoundarySchema = accentableBaseSchema.extend({
  kind: z.literal('trust-boundary'),
  containedElements: z.array(elementIdSchema).optional(),
  crossingFlows: z.array(elementIdSchema).optional(),
  shape: boundaryShapeSchema,
});

/** Trust boundary element. */
export type TrustBoundary = z.infer<typeof trustBoundarySchema>;

/** Trust boundary element as {@link trustBoundarySchema} accepts it. */
export type TrustBoundaryInput = z.input<typeof trustBoundarySchema>;

/**
 * Element-specific security facts are optional, and a canvas note carries
 * none, though a threat attaches to a note as to any other kind.
 */
export const elementSchema = z.discriminatedUnion('kind', [
  actorSchema,
  processSchema,
  storeSchema,
  flowSchema,
  trustBoundarySchema,
  textSchema,
]);

/** Any diagram element. */
export type Element = z.infer<typeof elementSchema>;

/** Any diagram element as {@link elementSchema} accepts it. */
export type ElementInput = z.input<typeof elementSchema>;

/** An element of a kind that takes an accent: every kind but a canvas note. */
export type AccentableElement = Exclude<Element, { readonly kind: 'text' }>;

/** Whether `element` is of a kind that takes an accent. */
export function takesAccent(element: Element): element is AccentableElement {
  return element.kind !== 'text';
}

/** The `kind` an element carries: {@link elementSchema}'s own discriminators. */
export const elementKindSchema = z.enum([
  'actor',
  'process',
  'store',
  'flow',
  'trust-boundary',
  'text',
]);

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
