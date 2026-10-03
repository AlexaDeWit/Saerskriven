import {
  OperationFailure,
  addAssumption,
  addMitigation,
  addThreat,
  assumptionIdSchema,
  assumptionSchema,
  assumptionStatusSchema,
  attachThreat,
  detachThreat,
  elementIdSchema,
  linkAssumption,
  linkAssumptionToModel,
  linkMitigation,
  linkThreatToModel,
  mitigationIdSchema,
  mitigationSchema,
  mitigationStatusSchema,
  nextThreatNumber,
  removeAssumption,
  removeMitigation,
  removeThreat,
  replaceAssumption,
  replaceMitigation,
  replaceThreat,
  setAssumptionStatus,
  setMitigationStatus,
  severitySchema,
  threatCategorySchema,
  threatIdSchema,
  threatSchema,
  threatStatusSchema,
  unlinkAssumption,
  unlinkAssumptionFromModel,
  unlinkMitigation,
  unlinkThreatFromModel,
  type AssumptionId,
  type MitigationId,
  type Model,
  type ThreatId,
} from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
import { unappliedEdit } from './operation-failure.js';

const threatEditSchema = z.object({
  threat: threatIdSchema.describe('The id of the threat to edit.'),
});

const replacedThreatSchema = threatSchema.omit({ number: true });

const addedThreatSchema = replacedThreatSchema.extend({
  appliesToModel: z
    .boolean()
    .default(false)
    .describe(
      'Whether the threat applies to the model as a whole. Left out, it does not.',
    ),
});

const mitigationEditSchema = z.object({
  mitigation: mitigationIdSchema.describe('The id of the mitigation to edit.'),
});

const assumptionEditSchema = z.object({
  assumption: assumptionIdSchema.describe('The id of the assumption to edit.'),
});

const linkedThreatSchema = z.object({
  threat: threatIdSchema.describe(
    'The threat the link is made to or taken from.',
  ),
});

const addedAssumptionSchema = assumptionSchema.extend({
  status: assumptionStatusSchema
    .default('unconfirmed')
    .describe('Left out, the assumption starts `unconfirmed`.'),
  appliesToModel: z
    .boolean()
    .default(false)
    .describe(
      'Whether the assumption applies to the model as a whole. Left out, it does not.',
    ),
});

const threatDetailsSchema = threatSchema
  .pick({ title: true, description: true })
  .partial();

const mitigationDetailsSchema = mitigationSchema
  .pick({ title: true, prose: true })
  .partial();

const assumptionDetailsSchema = assumptionSchema
  .pick({ prose: true })
  .partial();

/**
 * The threat, mitigation and assumption variants of the edit union, in the
 * order it lists them.
 */
export const registerEditSchemas = [
  z.object({ op: z.literal('add_threat'), threat: addedThreatSchema }),
  z.object({ op: z.literal('replace_threat'), threat: replacedThreatSchema }),
  threatEditSchema.extend({ op: z.literal('remove_threat') }),
  threatEditSchema.extend({
    op: z.literal('attach_threat'),
    element: elementIdSchema,
  }),
  threatEditSchema.extend({
    op: z.literal('detach_threat'),
    element: elementIdSchema,
  }),
  threatEditSchema.extend({ op: z.literal('link_threat_to_model') }),
  threatEditSchema.extend({ op: z.literal('unlink_threat_from_model') }),
  threatEditSchema.extend({
    op: z.literal('set_threat_status'),
    status: threatStatusSchema,
  }),
  threatEditSchema.extend({
    op: z.literal('set_threat_severity'),
    severity: severitySchema,
  }),
  threatEditSchema.extend({
    op: z.literal('set_threat_category'),
    category: threatCategorySchema,
  }),
  threatEditSchema
    .extend(threatDetailsSchema.shape)
    .extend({ op: z.literal('set_threat_details') }),
  z.object({ op: z.literal('add_mitigation'), mitigation: mitigationSchema }),
  z.object({
    op: z.literal('replace_mitigation'),
    mitigation: mitigationSchema,
  }),
  z.object({
    op: z.literal('remove_mitigation'),
    mitigation: mitigationIdSchema,
  }),
  mitigationEditSchema
    .extend(linkedThreatSchema.shape)
    .extend({ op: z.literal('link_mitigation') }),
  mitigationEditSchema
    .extend(linkedThreatSchema.shape)
    .extend({ op: z.literal('unlink_mitigation') }),
  mitigationEditSchema.extend({
    op: z.literal('set_mitigation_status'),
    status: mitigationStatusSchema,
  }),
  mitigationEditSchema
    .extend(mitigationDetailsSchema.shape)
    .extend({ op: z.literal('set_mitigation_details') }),
  z.object({
    op: z.literal('add_assumption'),
    assumption: addedAssumptionSchema,
  }),
  z.object({
    op: z.literal('replace_assumption'),
    assumption: assumptionSchema,
  }),
  z.object({
    op: z.literal('remove_assumption'),
    assumption: assumptionIdSchema,
  }),
  assumptionEditSchema
    .extend(linkedThreatSchema.shape)
    .extend({ op: z.literal('link_assumption') }),
  assumptionEditSchema
    .extend(linkedThreatSchema.shape)
    .extend({ op: z.literal('unlink_assumption') }),
  assumptionEditSchema.extend({ op: z.literal('link_assumption_to_model') }),
  assumptionEditSchema.extend({
    op: z.literal('unlink_assumption_from_model'),
  }),
  assumptionEditSchema.extend({
    op: z.literal('set_assumption_status'),
    status: assumptionStatusSchema,
  }),
  assumptionEditSchema
    .extend(assumptionDetailsSchema.shape)
    .extend({ op: z.literal('set_assumption_details') }),
] as const;

/** One threat, mitigation or assumption edit. */
export type RegisterEdit = z.infer<(typeof registerEditSchemas)[number]>;

const registerOps = new Set<string>(
  registerEditSchemas.map((schema) => schema.shape.op.value),
);

/** Whether `edit` is one of {@link registerEditSchemas}. */
export function isRegisterEdit(edit: {
  readonly op: string;
}): edit is RegisterEdit {
  return registerOps.has(edit.op);
}

/**
 * Applies one threat, mitigation or assumption edit. An edit that patches a
 * held record hands the patched record to that record's replace operation.
 * A threat edit carries no number: an added threat takes the next one, and a
 * replaced one keeps the number it holds.
 */
export function applyRegisterEdit(
  model: Model,
  edit: RegisterEdit,
): Either.Either<Model, OperationFailure> {
  switch (edit.op) {
    case 'add_threat':
      return addThreat(model, {
        ...edit.threat,
        number: nextThreatNumber(model),
      });
    case 'replace_threat':
      return withThreat(model, edit.threat.id, (held) => ({
        ...edit.threat,
        number: held.number,
      }));
    case 'remove_threat':
      return removeThreat(model, edit.threat);
    case 'attach_threat':
      return attachThreat(model, edit.threat, edit.element);
    case 'detach_threat':
      return detachThreat(model, edit.threat, edit.element);
    case 'link_threat_to_model':
      return linkThreatToModel(model, edit.threat);
    case 'unlink_threat_from_model':
      return unlinkThreatFromModel(model, edit.threat);
    case 'set_threat_status':
      return withThreat(model, edit.threat, (held) => ({
        ...held,
        status: edit.status,
      }));
    case 'set_threat_severity':
      return withThreat(model, edit.threat, (held) => ({
        ...held,
        severity: edit.severity,
      }));
    case 'set_threat_category':
      return withThreat(model, edit.threat, (held) => ({
        ...held,
        category: edit.category,
      }));
    case 'set_threat_details':
      return withThreat(model, edit.threat, (held) => ({
        ...held,
        title: edit.title ?? held.title,
        description: edit.description ?? held.description,
      }));
    case 'add_mitigation':
      return addMitigation(model, edit.mitigation);
    case 'replace_mitigation':
      return replaceMitigation(model, edit.mitigation);
    case 'remove_mitigation':
      return removeMitigation(model, edit.mitigation);
    case 'link_mitigation':
      return linkMitigation(model, edit.mitigation, edit.threat);
    case 'unlink_mitigation':
      return unlinkMitigation(model, edit.mitigation, edit.threat);
    case 'set_mitigation_status':
      return setMitigationStatus(model, edit.mitigation, edit.status);
    case 'set_mitigation_details':
      return withMitigation(model, edit.mitigation, (held) => ({
        ...held,
        title: edit.title ?? held.title,
        prose: edit.prose ?? held.prose,
      }));
    case 'add_assumption':
      return addAssumption(model, edit.assumption);
    case 'replace_assumption':
      return replaceAssumption(model, edit.assumption);
    case 'remove_assumption':
      return removeAssumption(model, edit.assumption);
    case 'link_assumption':
      return linkAssumption(model, edit.assumption, edit.threat);
    case 'unlink_assumption':
      return unlinkAssumption(model, edit.assumption, edit.threat);
    case 'link_assumption_to_model':
      return linkAssumptionToModel(model, edit.assumption);
    case 'unlink_assumption_from_model':
      return unlinkAssumptionFromModel(model, edit.assumption);
    case 'set_assumption_status':
      return setAssumptionStatus(model, edit.assumption, edit.status);
    case 'set_assumption_details':
      return withAssumption(model, edit.assumption, (held) => ({
        ...held,
        prose: edit.prose ?? held.prose,
      }));
    default:
      return unappliedEdit(edit);
  }
}

const withThreat = patching(
  (model) => model.threats,
  (threatId: ThreatId) => OperationFailure.UnknownThreat({ threatId }),
  replaceThreat,
);

const withMitigation = patching(
  (model) => model.mitigations,
  (mitigationId: MitigationId) =>
    OperationFailure.UnknownMitigation({ mitigationId }),
  replaceMitigation,
);

const withAssumption = patching(
  (model) => model.assumptions,
  (assumptionId: AssumptionId) =>
    OperationFailure.UnknownAssumption({ assumptionId }),
  replaceAssumption,
);

function patching<Held extends { readonly id: string }>(
  select: (model: Model) => readonly Held[],
  unknown: (id: Held['id']) => OperationFailure,
  replace: (model: Model, next: Held) => Either.Either<Model, OperationFailure>,
): (
  model: Model,
  id: Held['id'],
  change: (held: Held) => Held,
) => Either.Either<Model, OperationFailure> {
  return (model, id, change) =>
    Either.flatMap(
      Either.fromNullable(
        select(model).find((record) => record.id === id),
        () => unknown(id),
      ),
      (held) => replace(model, change(held)),
    );
}
