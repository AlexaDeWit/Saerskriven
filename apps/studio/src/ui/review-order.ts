import {
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

function inOrder<Item>(
  items: readonly Item[],
  compare: (left: Item, right: Item) => number,
): Item[] {
  const ordered = [...items];
  ordered.sort(compare);
  return ordered;
}

/**
 * Every status in order of how much risk it leaves live, open first and not
 * applicable last. The model's own tuple keeps its order: this one is the
 * studio's presentation, for the Status picker and the panel's threat list.
 */
export const statusesByLiveRisk: readonly ThreatStatus[] = inOrder(
  threatStatusSchema.options,
  (left, right) => liveRisk[left] - liveRisk[right],
);

/**
 * A copy of `threats` in the order a review reads them: by status as
 * {@link statusesByLiveRisk} orders it, then by severity from critical down
 * to undecided, then by id, so equal threats keep one order.
 */
export function inReviewOrder<Reviewed extends Threat>(
  threats: readonly Reviewed[],
): Reviewed[] {
  return inOrder(
    threats,
    (left, right) =>
      liveRisk[left.status] - liveRisk[right.status] ||
      severityRank[left.severity] - severityRank[right.severity] ||
      (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
  );
}
