import { z } from 'zod';
import { assumptionIdSchema, threatIdSchema } from './ids.js';
import { acceptedTextSchema } from './text.js';

/**
 * Whether the assumption still holds. `unconfirmed` is an assumption no one
 * has checked yet, and it raises no flag. An `invalidated` assumption raises
 * the `rests-on-invalidated-assumption` flag on each threat it links, which
 * `threatFlags` derives.
 */
export const assumptionStatusSchema = z.enum([
  'unconfirmed',
  'valid',
  'invalidated',
]);

/** Assumption status. */
export type AssumptionStatus = z.infer<typeof assumptionStatusSchema>;

/**
 * One assumption the analysis rests on. It applies to the model, to the
 * threats it links by id, or to both. `appliesToModel` is a stored
 * reference, never inferred from an empty `threats` list. `prose` is
 * markdown. Whether the ids resolve is checked by parseModel, not here.
 */
export const assumptionSchema = z.object({
  id: assumptionIdSchema,
  prose: acceptedTextSchema,
  status: assumptionStatusSchema,
  threats: z.array(threatIdSchema),
  appliesToModel: z.boolean(),
});

/** Assumption record. */
export type Assumption = z.infer<typeof assumptionSchema>;

/** Assumption record as {@link assumptionSchema} accepts it. */
export type AssumptionInput = z.input<typeof assumptionSchema>;
