import { Either } from 'effect';
import type { Assumption, AssumptionStatus } from './assumptions.js';
import type { AssumptionId, ThreatId } from './ids.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import {
  assumptionRegister,
  editedRecord,
  linkedThreats,
  relinkedRecord,
  replacedRecord,
  withRecordStatus,
} from './records.js';
import { unknownThreatIn } from './references.js';

type UnknownAssumptionFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownAssumption' }
>;

/** The failures {@link addAssumption} can produce. */
export type AddAssumptionFailure = Extract<
  OperationFailure,
  {
    _tag:
      | 'DuplicateAssumptionId'
      | 'AssumptionWithoutReference'
      | 'UnknownThreat';
  }
>;

/** The failures {@link replaceAssumption} can produce. */
export type ReplaceAssumptionFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownAssumption' | 'UnknownThreat' }
>;

/** The failure {@link removeAssumption} can produce. */
export type RemoveAssumptionFailure = UnknownAssumptionFailure;

/** The failures {@link linkAssumption} and {@link unlinkAssumption} can produce. */
export type AssumptionLinkFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownAssumption' | 'UnknownThreat' }
>;

/** The failure {@link setAssumptionStatus} can produce. */
export type SetAssumptionStatusFailure = UnknownAssumptionFailure;

/** The failure {@link linkAssumptionToModel} and {@link unlinkAssumptionFromModel} can produce. */
export type AssumptionModelLinkFailure = UnknownAssumptionFailure;

/**
 * Appends `assumption` to the register. Refuses a taken id, an assumption
 * that neither links a threat nor applies to the model, and a link to a
 * threat the model does not hold.
 */
export function addAssumption(
  model: Model,
  assumption: Assumption,
): Either.Either<Model, AddAssumptionFailure> {
  if (model.assumptions.some((candidate) => candidate.id === assumption.id)) {
    return Either.left(
      OperationFailure.DuplicateAssumptionId({ assumptionId: assumption.id }),
    );
  }
  if (!assumptionRegister.referenced(assumption)) {
    return Either.left(
      OperationFailure.AssumptionWithoutReference({
        assumptionId: assumption.id,
      }),
    );
  }
  const unlinkable = unknownThreatIn(model.threats, assumption.threats);
  if (unlinkable) {
    return Either.left(
      OperationFailure.UnknownThreat({ threatId: unlinkable }),
    );
  }
  return Either.right({
    ...model,
    assumptions: [...model.assumptions, assumption],
  });
}

/**
 * Swaps the assumption carrying `assumption.id` for `assumption` in place.
 * A replacement that leaves the assumption no threat link and no model link
 * removes it instead, unless it already had neither.
 */
export function replaceAssumption(
  model: Model,
  assumption: Assumption,
): Either.Either<Model, ReplaceAssumptionFailure> {
  return replacedRecord(model, assumptionRegister, assumption);
}

/**
 * Drops the assumption named by `assumptionId`. This is an explicit
 * removal, not a cull, and the threats it rested on are untouched.
 */
export function removeAssumption(
  model: Model,
  assumptionId: AssumptionId,
): Either.Either<Model, RemoveAssumptionFailure> {
  if (!model.assumptions.some((candidate) => candidate.id === assumptionId)) {
    return Either.left(OperationFailure.UnknownAssumption({ assumptionId }));
  }
  return Either.right({
    ...model,
    assumptions: model.assumptions.filter(
      (candidate) => candidate.id !== assumptionId,
    ),
  });
}

/**
 * Links the assumption to the threat. A link the assumption already holds
 * returns the model it was given.
 */
export function linkAssumption(
  model: Model,
  assumptionId: AssumptionId,
  threatId: ThreatId,
): Either.Either<Model, AssumptionLinkFailure> {
  return relinkedRecord(
    model,
    assumptionRegister,
    assumptionId,
    threatId,
    (threats) => linkedThreats(threats, threatId),
  );
}

/**
 * Unlinks the assumption from the threat, removing the assumption where
 * that was its last threat link and it does not apply to the model. A link
 * the assumption does not hold returns the model it was given.
 */
export function unlinkAssumption(
  model: Model,
  assumptionId: AssumptionId,
  threatId: ThreatId,
): Either.Either<Model, AssumptionLinkFailure> {
  return relinkedRecord(
    model,
    assumptionRegister,
    assumptionId,
    threatId,
    (threats) => threats.filter((id) => id !== threatId),
  );
}

/**
 * Sets the status of one assumption, and nothing else. The status it
 * already has returns the model it was given.
 */
export function setAssumptionStatus(
  model: Model,
  assumptionId: AssumptionId,
  status: AssumptionStatus,
): Either.Either<Model, SetAssumptionStatusFailure> {
  return withRecordStatus(model, assumptionRegister, assumptionId, status);
}

/**
 * Applies the assumption to the model. An assumption that already applies
 * returns the model it was given.
 */
export function linkAssumptionToModel(
  model: Model,
  assumptionId: AssumptionId,
): Either.Either<Model, AssumptionModelLinkFailure> {
  return withModelLink(model, assumptionId, true);
}

/**
 * Takes the model link away from the assumption, removing the assumption
 * where it links no threat. An assumption that does not apply returns the
 * model it was given.
 */
export function unlinkAssumptionFromModel(
  model: Model,
  assumptionId: AssumptionId,
): Either.Either<Model, AssumptionModelLinkFailure> {
  return withModelLink(model, assumptionId, false);
}

function withModelLink(
  model: Model,
  assumptionId: AssumptionId,
  appliesToModel: boolean,
): Either.Either<Model, AssumptionModelLinkFailure> {
  return editedRecord(model, assumptionRegister, assumptionId, (held) =>
    Either.right(
      held.appliesToModel === appliesToModel
        ? held
        : { ...held, appliesToModel },
    ),
  );
}
