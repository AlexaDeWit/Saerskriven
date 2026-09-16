import { z } from 'zod';
import { threatCategorySchema } from './categories.js';
import { elementIdSchema, threatIdSchema } from './ids.js';
import { acceptedTextSchema } from './text.js';

/**
 * Where a threat stands. `open` is the threat nobody has dispositioned yet.
 * The four that follow are the standard risk treatments: reduce it
 * (`mitigated`), move it to someone else such as an insurer or a supplier
 * (`transferred`), remove the feature or path that creates it (`avoided`),
 * or carry it knowingly (`accepted-risk`). `eliminated` is the threat a
 * change has made impossible rather than merely unlikely.
 * `not-applicable` is the threat that never applied to this system, which
 * is a judgement about the analysis rather than about the risk.
 */
export const threatStatusSchema = z.enum([
  'open',
  'mitigated',
  'transferred',
  'avoided',
  'accepted-risk',
  'eliminated',
  'not-applicable',
]);

/** Threat status. */
export type ThreatStatus = z.infer<typeof threatStatusSchema>;

/**
 * How bad the threat is if realized. `undecided` is a state of its own
 * rather than a missing value, for a threat with no defensible severity yet.
 */
export const severitySchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
  'undecided',
]);

/** Threat severity. */
export type Severity = z.infer<typeof severitySchema>;

/**
 * One threat, attached to any number of elements by id. `description` is
 * markdown prose, and a threat's mitigations are records that link it.
 * Threat numbers must be unique across the model and element ids must
 * resolve. parseModel enforces both, so this schema alone accepts duplicates
 * and dangling ids.
 */
export const threatSchema = z.object({
  id: threatIdSchema,
  number: z.int().positive(),
  title: acceptedTextSchema,
  category: threatCategorySchema,
  severity: severitySchema,
  status: threatStatusSchema,
  description: acceptedTextSchema,
  elements: z.array(elementIdSchema),
});

/** Threat record. */
export type Threat = z.infer<typeof threatSchema>;

/** Threat record as {@link threatSchema} accepts it. */
export type ThreatInput = z.input<typeof threatSchema>;

/**
 * A copy of `threats` ordered by threat number. A number is unique across a
 * model and never reissued, so the order is total.
 */
export function inNumberOrder<Numbered extends { readonly number: number }>(
  threats: readonly Numbered[],
): Numbered[] {
  const ordered = [...threats];
  ordered.sort((left, right) => left.number - right.number);
  return ordered;
}
