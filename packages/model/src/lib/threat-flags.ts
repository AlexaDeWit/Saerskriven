import { z } from 'zod';
import type { ElementId } from './ids.js';
import type { MitigationStatus } from './mitigations.js';
import type { Model } from './parse.js';
import type { Threat } from './threats.js';

/**
 * Where a threat's records disagree with its analysis, for the author to
 * act on. `mitigated-without-implemented-work` is a `mitigated` threat with
 * no linked mitigation `implemented` or `verified`.
 * `rests-on-invalidated-assumption` is a threat with at least one linked
 * `invalidated` assumption. A flag is derived, never stored, and never
 * changes a threat's status.
 */
export const threatFlagSchema = z.enum([
  'mitigated-without-implemented-work',
  'rests-on-invalidated-assumption',
]);

/** One of the flags {@link threatFlags} derives. */
export type ThreatFlag = z.infer<typeof threatFlagSchema>;

const implementedWork: ReadonlySet<MitigationStatus> = new Set([
  'implemented',
  'verified',
]);

/** The flags `model`'s records raise on `threat`, in schema order. */
export function threatFlags(
  model: Model,
  threat: Pick<Threat, 'id' | 'status'>,
): ThreatFlag[] {
  const unbacked =
    threat.status === 'mitigated' &&
    !model.mitigations.some(
      (mitigation) =>
        implementedWork.has(mitigation.status) &&
        mitigation.threats.includes(threat.id),
    );
  const invalidated = model.assumptions.some(
    (assumption) =>
      assumption.status === 'invalidated' &&
      assumption.threats.includes(threat.id),
  );
  return threatFlagSchema.options.filter((flag) =>
    flag === 'mitigated-without-implemented-work' ? unbacked : invalidated,
  );
}

/**
 * The flags `model`'s records raise on the threats naming each element, keyed
 * by element id, each flag once and in schema order. An element no flagged
 * threat names has no entry.
 */
export function flagsByElement(
  model: Model,
): ReadonlyMap<ElementId, readonly ThreatFlag[]> {
  const raised = new Map<ElementId, Set<ThreatFlag>>();
  for (const threat of model.threats) {
    const flags = threatFlags(model, threat);
    if (flags.length === 0) {
      continue;
    }
    for (const element of threat.elements) {
      const onElement = raised.get(element) ?? new Set<ThreatFlag>();
      for (const flag of flags) {
        onElement.add(flag);
      }
      raised.set(element, onElement);
    }
  }
  return new Map(
    [...raised].map(([element, flags]) => [
      element,
      threatFlagSchema.options.filter((flag) => flags.has(flag)),
    ]),
  );
}
