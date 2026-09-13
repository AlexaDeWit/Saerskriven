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

type ThreatLinked = {
  readonly id: string;
  readonly threats: readonly string[];
};

type RecordKey = 'mitigations' | 'assumptions';

type RecordIn<Key extends RecordKey> = Model[Key][number];

type UnknownThreatFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownThreat' }
>;

/**
 * The register a per-kind record operation edits, its failure for an id the
 * register does not hold, and whether a record still has a reference.
 */
export type RecordRegister<Key extends RecordKey, Unknown> = {
  readonly key: Key;
  readonly unknown: (id: RecordIn<Key>['id']) => Unknown;
  readonly referenced: (record: RecordIn<Key>) => boolean;
};

const threatLinked = (record: ThreatLinked): boolean =>
  record.threats.length > 0;

/** The mitigation register. A mitigation's references are its threat links. */
export const mitigationRegister: RecordRegister<
  'mitigations',
  Extract<OperationFailure, { _tag: 'UnknownMitigation' }>
> = {
  key: 'mitigations',
  unknown: (mitigationId) =>
    OperationFailure.UnknownMitigation({ mitigationId }),
  referenced: threatLinked,
};

/** The assumption register. An assumption's references are its threat links and its model link. */
export const assumptionRegister: RecordRegister<
  'assumptions',
  Extract<OperationFailure, { _tag: 'UnknownAssumption' }>
> = {
  key: 'assumptions',
  unknown: (assumptionId) =>
    OperationFailure.UnknownAssumption({ assumptionId }),
  referenced: (assumption) =>
    assumption.appliesToModel || threatLinked(assumption),
};

/**
 * Applies `edit` to one record, culling the record where the edit takes
 * away its last reference. An edit that returns the record it was given
 * returns the model it was given.
 */
export function editedRecord<Key extends RecordKey, Unknown, Refused>(
  model: Model,
  register: RecordRegister<Key, Unknown>,
  recordId: RecordIn<Key>['id'],
  edit: (held: RecordIn<Key>) => Either.Either<RecordIn<Key>, Refused>,
): Either.Either<Model, Unknown | Refused> {
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
export function replacedRecord<Key extends RecordKey, Unknown>(
  model: Model,
  register: RecordRegister<Key, Unknown>,
  record: RecordIn<Key>,
): Either.Either<Model, Unknown | UnknownThreatFailure> {
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
export function relinkedRecord<Key extends RecordKey, Unknown>(
  model: Model,
  register: RecordRegister<Key, Unknown>,
  recordId: RecordIn<Key>['id'],
  threatId: ThreatId,
  relink: (threats: readonly ThreatId[]) => ThreatId[],
): Either.Either<Model, Unknown | UnknownThreatFailure> {
  return editedRecord(model, register, recordId, (held) => {
    if (!model.threats.some(({ id }) => id === threatId)) {
      return Either.left(OperationFailure.UnknownThreat({ threatId }));
    }
    const threats = relink(held.threats);
    return Either.right(
      threats.length === held.threats.length ? held : { ...held, threats },
    );
  });
}

/** Sets one record's status. The status it already has returns the model it was given. */
export function withRecordStatus<Key extends RecordKey, Unknown>(
  model: Model,
  register: RecordRegister<Key, Unknown>,
  recordId: RecordIn<Key>['id'],
  status: RecordIn<Key>['status'],
): Either.Either<Model, Unknown> {
  return editedRecord(model, register, recordId, (held) =>
    Either.right(held.status === status ? held : { ...held, status }),
  );
}

/**
 * `records` with `edit` applied to each one, less every record the edit
 * takes from `referenced` to not. A record that had no reference before
 * the edit stays.
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
export function recordsLinkedTo<Linked extends ThreatLinked>(
  records: readonly Linked[],
  threatId: ThreatId,
): Linked[] {
  return records.filter((record) => record.threats.includes(threatId));
}

/** `threats` with `threatId` appended, unless it already names it. */
export function linkedThreats(
  threats: readonly ThreatId[],
  threatId: ThreatId,
): ThreatId[] {
  return threats.includes(threatId) ? [...threats] : [...threats, threatId];
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
