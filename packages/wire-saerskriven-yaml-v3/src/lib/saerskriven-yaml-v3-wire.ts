import { z } from 'zod';

const idSchema = z.string().min(1);

const pointSchema = z.object({ x: z.number(), y: z.number() });

const sizeSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

const waypointsSchema = z.array(pointSchema);

const elementBaseSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string(),
  outOfScope: z.boolean(),
  reasonOutOfScope: z.string(),
});

const actorSchema = elementBaseSchema.extend({
  kind: z.literal('actor'),
  providesAuthentication: z.boolean().optional(),
});

const processSchema = elementBaseSchema.extend({
  kind: z.literal('process'),
  handlesCardPayment: z.boolean().optional(),
  handlesGoodsOrServices: z.boolean().optional(),
  isWebApplication: z.boolean().optional(),
  privilegeLevel: z.string().optional(),
});

const storeSchema = elementBaseSchema.extend({
  kind: z.literal('store'),
  isALog: z.boolean().optional(),
  isEncrypted: z.boolean().optional(),
  isSigned: z.boolean().optional(),
  storesCredentials: z.boolean().optional(),
  storesInventory: z.boolean().optional(),
});

const attachedEndpointSchema = z.object({
  kind: z.literal('attached'),
  element: idSchema,
});

const freeEndpointSchema = z.object({ kind: z.literal('free') });

const endpointSchema = z.discriminatedUnion('kind', [
  attachedEndpointSchema,
  freeEndpointSchema,
]);

const flowSchema = elementBaseSchema.extend({
  kind: z.literal('flow'),
  protocol: z.string().optional(),
  isEncrypted: z.boolean().optional(),
  isPublicNetwork: z.boolean().optional(),
  trustBoundaryIds: z.array(z.string()).optional(),
  source: endpointSchema,
  target: endpointSchema,
  bidirectional: z.boolean().optional(),
});

const trustBoundarySchema = elementBaseSchema.extend({
  kind: z.literal('trust-boundary'),
  containedElements: z.array(z.string()).optional(),
  crossingFlows: z.array(z.string()).optional(),
});

const textSchema = elementBaseSchema.extend({
  kind: z.literal('text'),
  text: z.string(),
});

const elementSchema = z.discriminatedUnion('kind', [
  actorSchema,
  processSchema,
  storeSchema,
  flowSchema,
  trustBoundarySchema,
  textSchema,
]);

const placementBaseSchema = z.object({
  element: idSchema,
  accent: z.string().optional(),
});

const nodePlacementSchema = placementBaseSchema.extend({
  position: pointSchema,
  size: sizeSchema,
});

const boxBoundaryShapeSchema = z.object({
  kind: z.literal('box'),
  position: pointSchema,
  size: sizeSchema,
});

const curveBoundaryShapeSchema = z.object({
  kind: z.literal('curve'),
  waypoints: waypointsSchema.min(2),
});

const boundaryShapeSchema = z.discriminatedUnion('kind', [
  boxBoundaryShapeSchema,
  curveBoundaryShapeSchema,
]);

const boundaryPlacementSchema = placementBaseSchema.extend({
  shape: boundaryShapeSchema,
});

const sideSchema = z.enum(['top', 'right', 'bottom', 'left']);

const placedEndSchema = z.object({
  side: sideSchema.optional(),
  position: pointSchema.optional(),
});

const flowPlacementSchema = placementBaseSchema.extend({
  waypoints: waypointsSchema,
  source: placedEndSchema,
  target: placedEndSchema,
});

const placementSchema = z.union([
  nodePlacementSchema,
  boundaryPlacementSchema,
  flowPlacementSchema,
]);

const strideCategorySchema = z.object({
  methodology: z.literal('STRIDE'),
  category: z.enum([
    'spoofing',
    'tampering',
    'repudiation',
    'information-disclosure',
    'denial-of-service',
    'elevation-of-privilege',
  ]),
});

const linddunCategorySchema = z.object({
  methodology: z.literal('LINDDUN'),
  category: z.enum([
    'linking',
    'identifying',
    'non-repudiation',
    'detecting',
    'data-disclosure',
    'unawareness',
    'non-compliance',
  ]),
});

const ciaCategorySchema = z.object({
  methodology: z.literal('CIA'),
  category: z.enum(['confidentiality', 'integrity', 'availability']),
});

const ciaDieCategorySchema = z.object({
  methodology: z.literal('CIA-DIE'),
  category: z.enum([
    'confidentiality',
    'integrity',
    'availability',
    'distributed',
    'immutable',
    'ephemeral',
  ]),
});

const plot4aiCategorySchema = z.object({
  methodology: z.literal('PLOT4ai'),
  category: z.enum([
    'accountability-and-human-oversight',
    'bias-fairness-and-discrimination',
    'cybersecurity',
    'data-and-data-governance',
    'ethics-and-human-rights',
    'privacy-and-data-protection',
    'safety-and-environmental-impact',
    'transparency-and-accessibility',
  ]),
});

const customCategorySchema = z.object({
  methodology: z.literal('custom'),
  methodologyName: z.string().min(1),
  category: z.string().min(1),
});

const categorySchema = z.discriminatedUnion('methodology', [
  strideCategorySchema,
  linddunCategorySchema,
  ciaCategorySchema,
  ciaDieCategorySchema,
  plot4aiCategorySchema,
  customCategorySchema,
]);

const severitySchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
  'undecided',
]);

const threatStatusSchema = z.enum([
  'open',
  'mitigated',
  'transferred',
  'avoided',
  'accepted-risk',
  'eliminated',
  'not-applicable',
]);

const mitigationStatusSchema = z.enum(['proposed', 'implemented', 'verified']);

const assumptionStatusSchema = z.enum(['unconfirmed', 'valid', 'invalidated']);

const threatSchema = z.object({
  id: idSchema,
  number: z.int().positive(),
  title: z.string(),
  category: categorySchema,
  severity: severitySchema,
  status: threatStatusSchema,
  description: z.string(),
  elements: z.array(idSchema),
  appliesToModel: z.boolean().optional(),
});

const mitigationSchema = z.object({
  id: idSchema,
  title: z.string(),
  prose: z.string(),
  status: mitigationStatusSchema,
  threats: z.array(idSchema),
});

const assumptionSchema = z.object({
  id: idSchema,
  prose: z.string(),
  status: assumptionStatusSchema,
  threats: z.array(idSchema),
  appliesToModel: z.boolean(),
});

const diagramSchema = z.object({
  id: idSchema,
  title: z.string(),
  placements: z.array(placementSchema),
});

const metadataSchema = z.object({
  title: z.string(),
  owner: z.string(),
  description: z.string(),
  contributors: z.array(z.string()),
});

/**
 * Version 3 holds each element once, in the root `elements` list, and each
 * diagram draws elements through `placements`: the element's id, its accent
 * there, and its geometry there, told apart by the keys a placement holds.
 * Every key version 2 makes optional stays optional, without a default, and
 * a placement's `accent` is text rather than an enumerated vocabulary, so a
 * file holding a key from a later release still reads.
 */
export const saerskrivenYamlV3WireSchema = z.object({
  formatVersion: z.literal(3),
  metadata: metadataSchema,
  assumptions: z.array(assumptionSchema),
  diagrams: z.array(diagramSchema),
  elements: z.array(elementSchema),
  mitigations: z.array(mitigationSchema),
  threats: z.array(threatSchema),
  lastIssuedThreatNumber: z.int().nonnegative(),
});

/** A whole Saerskriven YAML version 3 document. */
export type SaerskrivenYamlV3Document = z.infer<
  typeof saerskrivenYamlV3WireSchema
>;

/** What a Saerskriven YAML version 3 file says about the model as a whole. */
export type SaerskrivenYamlV3Metadata = z.infer<typeof metadataSchema>;

/** One diagram of a Saerskriven YAML version 3 document. */
export type SaerskrivenYamlV3Diagram = z.infer<typeof diagramSchema>;

/** One element of a Saerskriven YAML version 3 document, wherever it is drawn. */
export type SaerskrivenYamlV3Element = z.infer<typeof elementSchema>;

/** The element a Saerskriven YAML version 3 flow starts or ends at, or none. */
export type SaerskrivenYamlV3Endpoint = z.infer<typeof endpointSchema>;

/** One element drawn on one Saerskriven YAML version 3 diagram. */
export type SaerskrivenYamlV3Placement = z.infer<typeof placementSchema>;

/** How one end of a Saerskriven YAML version 3 flow is drawn on one diagram. */
export type SaerskrivenYamlV3PlacedEnd = z.infer<typeof placedEndSchema>;

/** The geometry of a Saerskriven YAML version 3 trust boundary on one diagram. */
export type SaerskrivenYamlV3BoundaryShape = z.infer<
  typeof boundaryShapeSchema
>;

/** One threat of a Saerskriven YAML version 3 document. */
export type SaerskrivenYamlV3Threat = z.infer<typeof threatSchema>;

/** One mitigation of a Saerskriven YAML version 3 document. */
export type SaerskrivenYamlV3Mitigation = z.infer<typeof mitigationSchema>;

/** One assumption of a Saerskriven YAML version 3 document. */
export type SaerskrivenYamlV3Assumption = z.infer<typeof assumptionSchema>;
