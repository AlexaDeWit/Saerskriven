import type { ThreatFlag } from '@saerskriven/model';

/** What the studio calls each flag a threat can raise, wherever it names one. */
export const flagLabels = {
  'mitigated-without-implemented-work': 'Mitigated without implemented work',
  'rests-on-invalidated-assumption': 'Rests on an invalidated assumption',
} as const satisfies Record<ThreatFlag, string>;
