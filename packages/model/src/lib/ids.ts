import { z } from 'zod';
import { acceptedTextSchema } from './text.js';

const minimumIdLength = 2;

/**
 * Identifier of one element in a model: any {@link acceptedTextSchema} of two
 * or more characters, the bound Threat Dragon puts on a cell id, so ids from
 * foreign files pass through unchanged. Element ids are unique across the
 * whole model, which parseModel enforces. The brand exists at compile time
 * only.
 */
export const elementIdSchema = acceptedTextSchema
  .min(minimumIdLength)
  .brand<'ElementId'>();

/** Branded element id. */
export type ElementId = z.infer<typeof elementIdSchema>;

/**
 * Identifier of one diagram in a model. Same contract as
 * {@link elementIdSchema} except for length: Threat Dragon numbers its
 * diagrams from zero and the read codec keeps that number as the id, so a
 * single character must parse here.
 */
export const diagramIdSchema = acceptedTextSchema.min(1).brand<'DiagramId'>();

/** Branded diagram id. */
export type DiagramId = z.infer<typeof diagramIdSchema>;

/**
 * Identifier of one threat in a model. Same contract as
 * {@link elementIdSchema}, and parseModel checks uniqueness among
 * threats.
 */
export const threatIdSchema = acceptedTextSchema
  .min(minimumIdLength)
  .brand<'ThreatId'>();

/** Branded threat id. */
export type ThreatId = z.infer<typeof threatIdSchema>;

/**
 * Identifier of one mitigation in a model. Same contract as
 * {@link elementIdSchema}, and parseModel checks uniqueness among
 * mitigations.
 */
export const mitigationIdSchema = acceptedTextSchema
  .min(minimumIdLength)
  .brand<'MitigationId'>();

/** Branded mitigation id. */
export type MitigationId = z.infer<typeof mitigationIdSchema>;

/**
 * Identifier of one assumption in a model. Same contract as
 * {@link elementIdSchema}, and parseModel checks uniqueness among
 * assumptions.
 */
export const assumptionIdSchema = acceptedTextSchema
  .min(minimumIdLength)
  .brand<'AssumptionId'>();

/** Branded assumption id. */
export type AssumptionId = z.infer<typeof assumptionIdSchema>;

const fresh = <Schema extends z.ZodType>(schema: Schema): z.infer<Schema> =>
  schema.parse(crypto.randomUUID());

/**
 * Generates a fresh element id as a UUID. Parsing accepts any id the schema
 * does. Requires a secure context:
 * crypto.randomUUID is undefined on plain-http browser pages.
 */
export function generateElementId(): ElementId {
  return fresh(elementIdSchema);
}

/** Generates a fresh diagram id as a UUID, on the terms of {@link generateElementId}. */
export function generateDiagramId(): DiagramId {
  return fresh(diagramIdSchema);
}

/** Generates a fresh threat id as a UUID, on the terms of {@link generateElementId}. */
export function generateThreatId(): ThreatId {
  return fresh(threatIdSchema);
}

/** Generates a fresh mitigation id as a UUID, on the terms of {@link generateElementId}. */
export function generateMitigationId(): MitigationId {
  return fresh(mitigationIdSchema);
}

/** Generates a fresh assumption id as a UUID, on the terms of {@link generateElementId}. */
export function generateAssumptionId(): AssumptionId {
  return fresh(assumptionIdSchema);
}
