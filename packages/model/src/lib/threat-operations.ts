import { Either } from 'effect';
import type { ElementId, ThreatId } from './ids.js';
import { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';
import {
  assumptionRegister,
  culledAfter,
  mitigationRegister,
  withId,
  withoutId,
} from './records.js';
import { elementIdsAcross, unknownElementIn } from './references.js';
import type { Threat } from './threats.js';

/** The failures {@link addThreat} can produce. */
export type AddThreatFailure = Extract<
  OperationFailure,
  { _tag: 'DuplicateThreatId' | 'ReusedThreatNumber' | 'UnknownElement' }
>;

/** The failure {@link removeThreat} can produce. */
export type RemoveThreatFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownThreat' }
>;

/** The failures {@link replaceThreat} can produce. */
export type ReplaceThreatFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownThreat' | 'ChangedThreatNumber' | 'UnknownElement' }
>;

type ThreatLinkFailure = Extract<
  OperationFailure,
  { _tag: 'UnknownThreat' | 'UnknownElement' }
>;

/** The failures {@link attachThreat} can produce. */
export type AttachThreatFailure = ThreatLinkFailure;

/** The failures {@link detachThreat} can produce. */
export type DetachThreatFailure = ThreatLinkFailure;

/**
 * Appends `threat` to the register and advances the last issued number to
 * its number, which must be above the last issued ({@link nextThreatNumber}
 * yields the lowest such number). Fails on a taken id, a spent number, or a
 * link to an element the model does not hold.
 */
export function addThreat(
  model: Model,
  threat: Threat,
): Either.Either<Model, AddThreatFailure> {
  if (model.threats.some((candidate) => candidate.id === threat.id)) {
    return Either.left(
      OperationFailure.DuplicateThreatId({ threatId: threat.id }),
    );
  }
  if (threat.number <= model.lastIssuedThreatNumber) {
    return Either.left(
      OperationFailure.ReusedThreatNumber({ number: threat.number }),
    );
  }
  const unlinkable = unknownElementIn(model.diagrams, threat.elements);
  if (unlinkable) {
    return Either.left(
      OperationFailure.UnknownElement({ elementId: unlinkable }),
    );
  }
  return Either.right({
    ...model,
    threats: [...model.threats, threat],
    lastIssuedThreatNumber: threat.number,
  });
}

/**
 * Returns a new model without the threat named by `threatId`. Every
 * mitigation and assumption loses its link to it, and a record whose last
 * reference it was goes with it: an assumption that applies to the model
 * stays. The removed threat's number stays spent, so the gap it leaves is
 * permanent. Fails when the threat is unknown.
 */
export function removeThreat(
  model: Model,
  threatId: ThreatId,
): Either.Either<Model, RemoveThreatFailure> {
  if (!model.threats.some((threat) => threat.id === threatId)) {
    return Either.left(OperationFailure.UnknownThreat({ threatId }));
  }
  return Either.right(
    withoutThreatLinks(
      {
        ...model,
        threats: model.threats.filter((threat) => threat.id !== threatId),
      },
      threatId,
    ),
  );
}

/**
 * `model` with `relink` applied to every threat's elements, the threats that
 * relink leaves attached to none removed, and {@link removeThreat}'s cascade
 * run for each of them. A threat that was attached to no element before the
 * relink stays, so a file read with one keeps it. This is the package's own
 * helper, not part of its public surface: outside it, {@link droppedThreats}
 * is how a caller learns what a cull took.
 */
export function withCulledThreats(
  model: Model,
  relink: (threat: Threat) => Threat,
): Model {
  const kept = culledAfter(model.threats, attached, relink);
  const keptIds = new Set(kept.map((threat) => threat.id));
  return model.threats
    .filter((threat) => !keptIds.has(threat.id))
    .reduce<Model>(
      (current, threat) => withoutThreatLinks(current, threat.id),
      {
        ...model,
        threats: kept,
      },
    );
}

/** The threats `before` holds and `after` does not, in register order. */
export function droppedThreats(before: Model, after: Model): Threat[] {
  const held = new Set(after.threats.map((threat) => threat.id));
  return before.threats.filter((threat) => !held.has(threat.id));
}

/**
 * Swaps the threat carrying `threat.id` for `threat` in place. Every field
 * but the id and the number is the caller's to change, and a replacement
 * naming no element leaves the threat where it is: only {@link detachThreat}
 * and an element removal cull one. Fails on an unknown threat, a changed
 * number, or a link to an element the model does not hold.
 */
export function replaceThreat(
  model: Model,
  threat: Threat,
): Either.Either<Model, ReplaceThreatFailure> {
  const replaced = model.threats.find(
    (candidate) => candidate.id === threat.id,
  );
  if (!replaced) {
    return Either.left(OperationFailure.UnknownThreat({ threatId: threat.id }));
  }
  if (replaced.number !== threat.number) {
    return Either.left(
      OperationFailure.ChangedThreatNumber({
        threatId: threat.id,
        number: threat.number,
      }),
    );
  }
  const unlinkable = unknownElementIn(model.diagrams, threat.elements);
  if (unlinkable) {
    return Either.left(
      OperationFailure.UnknownElement({ elementId: unlinkable }),
    );
  }
  return Either.right(withThreat(model, threat));
}

/**
 * Links the element to the threat. Attaching an element the threat already
 * carries changes nothing. Fails when either id names nothing.
 */
export function attachThreat(
  model: Model,
  threatId: ThreatId,
  elementId: ElementId,
): Either.Either<Model, AttachThreatFailure> {
  return Either.map(linkableThreat(model, threatId, elementId), (threat) =>
    withThreat(model, {
      ...threat,
      elements: withId(threat.elements, elementId),
    }),
  );
}

/**
 * Unlinks the element from the threat, removing the threat where it was its
 * last attachment, with {@link removeThreat}'s cascade. Detaching an element
 * the threat does not carry changes nothing. Fails when either id names
 * nothing. {@link droppedThreats} says whether the threat went.
 */
export function detachThreat(
  model: Model,
  threatId: ThreatId,
  elementId: ElementId,
): Either.Either<Model, DetachThreatFailure> {
  return Either.map(linkableThreat(model, threatId, elementId), () =>
    withCulledThreats(model, (held) =>
      held.id === threatId
        ? { ...held, elements: withoutId(held.elements, elementId) }
        : held,
    ),
  );
}

/**
 * One above the number the model last issued, so a removed threat's number
 * is never handed out again.
 */
export function nextThreatNumber(model: Model): number {
  return model.lastIssuedThreatNumber + 1;
}

const attached = (threat: Threat): boolean => threat.elements.length > 0;

function withThreat(model: Model, next: Threat): Model {
  return {
    ...model,
    threats: model.threats.map((threat) =>
      threat.id === next.id ? next : threat,
    ),
  };
}

function withoutThreatLinks(model: Model, threatId: ThreatId): Model {
  const unlinked = <Linked extends { readonly threats: ThreatId[] }>(
    record: Linked,
  ): Linked => ({
    ...record,
    threats: withoutId(record.threats, threatId),
  });
  return {
    ...model,
    mitigations: culledAfter(
      model.mitigations,
      mitigationRegister.referenced,
      unlinked,
    ),
    assumptions: culledAfter(
      model.assumptions,
      assumptionRegister.referenced,
      unlinked,
    ),
  };
}

function linkableThreat(
  model: Model,
  threatId: ThreatId,
  elementId: ElementId,
): Either.Either<Threat, ThreatLinkFailure> {
  const threat = model.threats.find((candidate) => candidate.id === threatId);
  if (!threat) {
    return Either.left(OperationFailure.UnknownThreat({ threatId }));
  }
  return elementIdsAcross(model.diagrams).has(elementId)
    ? Either.right(threat)
    : Either.left(OperationFailure.UnknownElement({ elementId }));
}
