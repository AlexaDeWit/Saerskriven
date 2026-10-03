import { sampleThreat } from '../store/store.fixtures.js';
import { threatId } from '@saerskriven/model/fixtures';
import type { Severity, Threat, ThreatStatus } from '@saerskriven/model';
import { inReviewOrder, statusesByLiveRisk } from './review-order.js';

const threat = (
  id: string,
  status: ThreatStatus,
  severity: Severity,
): Threat => ({ ...sampleThreat, id: threatId(id), status, severity });

const idsOf = (threats: readonly Threat[]): readonly string[] =>
  threats.map(({ id }) => id);

describe('the review order', () => {
  it('ranks statuses by how much risk each leaves live', () => {
    expect(statusesByLiveRisk).toEqual([
      'open',
      'accepted-risk',
      'transferred',
      'mitigated',
      'avoided',
      'eliminated',
      'not-applicable',
    ]);
  });

  it('puts every open threat first, then descends through severity inside each status', () => {
    const threats = [
      threat('mitigated-low', 'mitigated', 'low'),
      threat('open-undecided', 'open', 'undecided'),
      threat('accepted-critical', 'accepted-risk', 'critical'),
      threat('open-low', 'open', 'low'),
      threat('mitigated-critical', 'mitigated', 'critical'),
      threat('open-critical', 'open', 'critical'),
      threat('open-high', 'open', 'high'),
      threat('na-critical', 'not-applicable', 'critical'),
      threat('open-medium', 'open', 'medium'),
    ];

    expect(idsOf(inReviewOrder(threats))).toEqual([
      'open-critical',
      'open-high',
      'open-medium',
      'open-low',
      'open-undecided',
      'accepted-critical',
      'mitigated-critical',
      'mitigated-low',
      'na-critical',
    ]);
  });

  it('breaks a tie on the id, whatever order the threats arrive in', () => {
    const tied = [
      threat('threat-b', 'open', 'high'),
      threat('threat-c', 'open', 'high'),
      threat('threat-a', 'open', 'high'),
    ];

    expect(idsOf(inReviewOrder(tied))).toEqual([
      'threat-a',
      'threat-b',
      'threat-c',
    ]);
    expect(idsOf(inReviewOrder([tied[2], tied[1], tied[0]]))).toEqual(
      idsOf(inReviewOrder(tied)),
    );
  });
});
