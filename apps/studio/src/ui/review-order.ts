import {
  inNumberOrder,
  threatStatusSchema,
  type Severity,
  type Threat,
  type ThreatStatus,
} from '@saerskriven/model';

const liveRisk = {
  open: 0,
  'accepted-risk': 1,
  transferred: 2,
  mitigated: 3,
  avoided: 4,
  eliminated: 5,
  'not-applicable': 6,
} as const satisfies Record<ThreatStatus, number>;

const severityRank = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  undecided: 4,
} as const satisfies Record<Severity, number>;

/**
 * Every status in order of how much risk it leaves live, open first and not
 * applicable last. The model's own tuple keeps its order: this one is the
 * studio's presentation, for the Status picker and the panel's threat list.
 */
export const statusesByLiveRisk: readonly ThreatStatus[] = byLiveRisk([
  ...threatStatusSchema.options,
]);

/**
 * A copy of `threats` in the order a review reads them: by status as
 * {@link statusesByLiveRisk} orders it, then by severity from critical down
 * to undecided, then by number, so equal threats read in the order they were
 * raised.
 */
export function inReviewOrder<Reviewed extends Threat>(
  threats: readonly Reviewed[],
): Reviewed[] {
  const ordered = inNumberOrder(threats);
  ordered.sort(
    (left, right) =>
      liveRisk[left.status] - liveRisk[right.status] ||
      severityRank[left.severity] - severityRank[right.severity],
  );
  return ordered;
}

function byLiveRisk(statuses: ThreatStatus[]): ThreatStatus[] {
  statuses.sort((left, right) => liveRisk[left] - liveRisk[right]);
  return statuses;
}
