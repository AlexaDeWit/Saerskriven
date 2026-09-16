import { Either } from 'effect';
import { z } from 'zod';
import {
  assumptionIdSchema,
  mitigationIdSchema,
  type ThreatId,
} from './ids.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import { unknownThreatIn } from './references.js';

/** Names one record across both registers, where a mitigation and an assumption may share an id. */
export const recordReferenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('mitigation'), id: mitigationIdSchema }),
  z.object({ kind: z.literal('assumption'), id: assumptionIdSchema }),
]);

/** A mitigation or an assumption, by kind and id. */
export type RecordReference = z.infer<typeof recordReferenceSchema>;

type RecordKey = 'mitigations' | 'assumptions';

type RecordIn<Key extends RecordKey> = Model[Key][number];

type UnknownThreatFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownThreat' }
>;

type RegisterFailures = {
  readonly unknown: OperationFailure;
  readonly duplicate: OperationFailure;
  readonly unreferenced: OperationFailure;
};

/**
 * The register a per-kind record operation edits, the failures it refuses an
 * unknown id, a taken id and a record with no reference with, and whether a
 * record still has a reference.
 */
export type RecordRegister<
  Key extends RecordKey,
  Failures extends RegisterFailures,
> = {
  readonly key: Key;
  readonly unknown: (id: RecordIn<Key>['id']) => Failures['unknown'];
  readonly duplicate: (id: RecordIn<Key>['id']) => Failures['duplicate'];
  readonly unreferenced: (id: RecordIn<Key>['id']) => Failures['unreferenced'];
  readonly referenced: (record: RecordIn<Key>) => boolean;
};

const threatLinked = (record: { readonly threats: readonly string[] }) =>
  record.threats.length > 0;

/** The mitigation register. A mitigation's references are its threat links. */
export const mitigationRegister: RecordRegister<
  'mitigations',
  {
    unknown: Extract<OperationFailure, { _tag: 'UnknownMitigation' }>;
    duplicate: Extract<OperationFailure, { _tag: 'DuplicateMitigationId' }>;
    unreferenced: Extract<OperationFailure, { _tag: 'RecordWithoutThreat' }>;
  }
> = {
  key: 'mitigations',
  unknown: (mitigationId) =>
    OperationFailure.UnknownMitigation({ mitigationId }),
  duplicate: (mitigationId) =>
    OperationFailure.DuplicateMitigationId({ mitigationId }),
  unreferenced: (id) =>
    OperationFailure.RecordWithoutThreat({
      record: { kind: 'mitigation', id },
    }),
  referenced: threatLinked,
};

/** The assumption register. An assumption's references are its threat links and its model link. */
export const assumptionRegister: RecordRegister<
  'assumptions',
  {
    unknown: Extract<OperationFailure, { _tag: 'UnknownAssumption' }>;
    duplicate: Extract<OperationFailure, { _tag: 'DuplicateAssumptionId' }>;
    unreferenced: Extract<
      OperationFailure,
      { _tag: 'AssumptionWithoutReference' }
    >;
  }
> = {
  key: 'assumptions',
  unknown: (assumptionId) =>
    OperationFailure.UnknownAssumption({ assumptionId }),
  duplicate: (assumptionId) =>
    OperationFailure.DuplicateAssumptionId({ assumptionId }),
  unreferenced: (assumptionId) =>
    OperationFailure.AssumptionWithoutReference({ assumptionId }),
  referenced: (assumption) =>
    assumption.appliesToModel || threatLinked(assumption),
};

/**
 * Appends `record` to its register. Refuses a taken id, a record with no
 * reference, and a link to a threat the model does not hold.
 */
export function addedRecord<
  Key extends RecordKey,
  Failures extends RegisterFailures,
>(
  model: Model,
  register: RecordRegister<Key, Failures>,
  record: RecordIn<Key>,
): Either.Either<
  Model,
  Failures['duplicate'] | Failures['unreferenced'] | UnknownThreatFailure
> {
  const records: readonly RecordIn<Key>[] = model[register.key];
  if (records.some(({ id }) => id === record.id)) {
    return Either.left(register.duplicate(record.id));
  }
  if (!register.referenced(record)) {
    return Either.left(register.unreferenced(record.id));
  }
  const unlinkable = unknownThreatIn(model.threats, record.threats);
  if (unlinkable) {
    return Either.left(
      OperationFailure.UnknownThreat({ threatId: unlinkable }),
    );
  }
  return Either.right({ ...model, [register.key]: [...records, record] });
}

/** Drops one record. This is an explicit removal, not a cull. */
export function removedRecord<
  Key extends RecordKey,
  Failures extends RegisterFailures,
>(
  model: Model,
  register: RecordRegister<Key, Failures>,
  recordId: RecordIn<Key>['id'],
): Either.Either<Model, Failures['unknown']> {
  const records: readonly RecordIn<Key>[] = model[register.key];
  if (!records.some(({ id }) => id === recordId)) {
    return Either.left(register.unknown(recordId));
  }
  return Either.right({
    ...model,
    [register.key]: records.filter(({ id }) => id !== recordId),
  });
}

/**
 * Applies `edit` to one record, culling the record where the edit takes
 * away its last reference. An edit that returns the record it was given
 * returns the model it was given.
 */
export function editedRecord<
  Key extends RecordKey,
  Failures extends RegisterFailures,
  Refused,
>(
  model: Model,
  register: RecordRegister<Key, Failures>,
  recordId: RecordIn<Key>['id'],
  edit: (held: RecordIn<Key>) => Either.Either<RecordIn<Key>, Refused>,
): Either.Either<Model, Failures['unknown'] | Refused> {
  const records: readonly RecordIn<Key>[] = model[register.key];
  const held = records.find(({ id }) => id === recordId);
  if (!held) {
    return Either.left(register.unknown(recordId));
  }
  return Either.map(edit(held), (next): Model =>
    next === held
      ? model
      : {
          ...model,
          [register.key]: culledAfter(
            records,
            register.referenced,
            (candidate) => (candidate.id === recordId ? next : candidate),
          ),
        },
  );
}

/**
 * Swaps the record carrying `record.id` for `record` in place, culling it
 * where that takes away its last reference. Refuses a link to a threat the
 * model does not hold.
 */
export function replacedRecord<
  Key extends RecordKey,
  Failures extends RegisterFailures,
>(
  model: Model,
  register: RecordRegister<Key, Failures>,
  record: RecordIn<Key>,
): Either.Either<Model, Failures['unknown'] | UnknownThreatFailure> {
  return editedRecord(model, register, record.id, () => {
    const unlinkable = unknownThreatIn(model.threats, record.threats);
    return unlinkable
      ? Either.left(OperationFailure.UnknownThreat({ threatId: unlinkable }))
      : Either.right(record);
  });
}

/**
 * Applies `relink` to the threat links of one record, culling the record
 * where that takes away its last reference. A relink that changes no link
 * returns the model it was given.
 */
export function relinkedRecord<
  Key extends RecordKey,
  Failures extends RegisterFailures,
>(
  model: Model,
  register: RecordRegister<Key, Failures>,
  recordId: RecordIn<Key>['id'],
  threatId: ThreatId,
  relink: (threats: readonly ThreatId[], threatId: ThreatId) => ThreatId[],
): Either.Either<Model, Failures['unknown'] | UnknownThreatFailure> {
  return editedRecord(model, register, recordId, (held) => {
    if (!model.threats.some(({ id }) => id === threatId)) {
      return Either.left(OperationFailure.UnknownThreat({ threatId }));
    }
    const threats = relink(held.threats, threatId);
    return Either.right(
      threats.length === held.threats.length ? held : { ...held, threats },
    );
  });
}

/** Sets one record's status. The status it already has returns the model it was given. */
export function withRecordStatus<
  Key extends RecordKey,
  Failures extends RegisterFailures,
>(
  model: Model,
  register: RecordRegister<Key, Failures>,
  recordId: RecordIn<Key>['id'],
  status: RecordIn<Key>['status'],
): Either.Either<Model, Failures['unknown']> {
  return editedRecord(model, register, recordId, (held) =>
    Either.right(held.status === status ? held : { ...held, status }),
  );
}

/**
 * `records` with `edit` applied to each one, culling a record the edit
 * leaves with no reference when it had one before. A record that had no
 * reference before the edit stays.
 */
export function culledAfter<Linked>(
  records: readonly Linked[],
  referenced: (record: Linked) => boolean,
  edit: (record: Linked) => Linked,
): Linked[] {
  return records.flatMap((record) => {
    const next = edit(record);
    return referenced(record) && !referenced(next) ? [] : [next];
  });
}

/** The records of one kind linked to `threatId`, in register order. */
export function recordsLinkedTo<
  Linked extends { readonly threats: readonly string[] },
>(records: readonly Linked[], threatId: ThreatId): Linked[] {
  return records.filter((record) => record.threats.includes(threatId));
}

/** `ids` with `id` appended, unless it already holds it. */
export function withId<Id extends string>(ids: readonly Id[], id: Id): Id[] {
  return ids.includes(id) ? [...ids] : [...ids, id];
}

/** `ids` without `id`. */
export function withoutId<Id extends string>(ids: readonly Id[], id: Id): Id[] {
  return ids.filter((held) => held !== id);
}

/**
 * The records `before` holds and `after` does not, mitigations first, each
 * in register order.
 */
export function droppedRecords(before: Model, after: Model): RecordReference[] {
  const heldMitigations = new Set(after.mitigations.map(({ id }) => id));
  const heldAssumptions = new Set(after.assumptions.map(({ id }) => id));
  return [
    ...before.mitigations
      .filter(({ id }) => !heldMitigations.has(id))
      .map(({ id }): RecordReference => ({ kind: 'mitigation', id })),
    ...before.assumptions
      .filter(({ id }) => !heldAssumptions.has(id))
      .map(({ id }): RecordReference => ({ kind: 'assumption', id })),
  ];
}
