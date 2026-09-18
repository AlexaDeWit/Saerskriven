import type {
  CustomCategory,
  Element,
  Severity,
  Side,
  ThreatCategory,
  ThreatFlag,
  ThreatStatus,
} from '@saerskriven/model';
import type { ColourMode } from '../theme-preference.js';

/** A category the model enumerates, as opposed to one an author named. */
export type EnumeratedCategory = Exclude<
  ThreatCategory,
  CustomCategory
>['category'];

export const severityMessages = {
  low: 'enums.severity-low',
  medium: 'enums.severity-medium',
  high: 'enums.severity-high',
  critical: 'enums.severity-critical',
  undecided: 'enums.severity-undecided',
} as const satisfies Record<Severity, string>;

export const statusMessages = {
  open: 'enums.status-open',
  mitigated: 'enums.status-mitigated',
  transferred: 'enums.status-transferred',
  avoided: 'enums.status-avoided',
  'accepted-risk': 'enums.status-accepted-risk',
  eliminated: 'enums.status-eliminated',
  'not-applicable': 'enums.status-not-applicable',
} as const satisfies Record<ThreatStatus, string>;

export const flagMessages = {
  'mitigated-without-implemented-work':
    'enums.flag-mitigated-without-implemented-work',
  'rests-on-invalidated-assumption':
    'enums.flag-rests-on-invalidated-assumption',
} as const satisfies Record<ThreatFlag, string>;

/** What an element is called in a sentence when it carries no name. */
export const articleKindMessages = {
  actor: 'enums.the-actor',
  process: 'enums.the-process',
  store: 'enums.the-store',
  text: 'enums.the-text',
  flow: 'enums.the-flow',
  'trust-boundary': 'enums.the-trust-boundary',
} as const satisfies Record<Element['kind'], string>;

export const kindMessages = {
  actor: 'enums.kind-actor',
  process: 'enums.kind-process',
  store: 'enums.kind-store',
  text: 'enums.kind-text',
  flow: 'enums.kind-flow',
  'trust-boundary': 'enums.kind-trust-boundary',
} as const satisfies Record<Element['kind'], string>;

export const sideMessages = {
  top: 'enums.side-top',
  right: 'enums.side-right',
  bottom: 'enums.side-bottom',
  left: 'enums.side-left',
} as const satisfies Record<Side, string>;

export const colourModeMessages = {
  system: 'enums.colour-system',
  light: 'enums.colour-light',
  dark: 'enums.colour-dark',
} as const satisfies Record<ColourMode, string>;

export const categoryMessages = {
  spoofing: 'enums.category-spoofing',
  tampering: 'enums.category-tampering',
  repudiation: 'enums.category-repudiation',
  'information-disclosure': 'enums.category-information-disclosure',
  'denial-of-service': 'enums.category-denial-of-service',
  'elevation-of-privilege': 'enums.category-elevation-of-privilege',
  linking: 'enums.category-linking',
  identifying: 'enums.category-identifying',
  'non-repudiation': 'enums.category-non-repudiation',
  detecting: 'enums.category-detecting',
  'data-disclosure': 'enums.category-data-disclosure',
  unawareness: 'enums.category-unawareness',
  'non-compliance': 'enums.category-non-compliance',
  confidentiality: 'enums.category-confidentiality',
  integrity: 'enums.category-integrity',
  availability: 'enums.category-availability',
  distributed: 'enums.category-distributed',
  immutable: 'enums.category-immutable',
  ephemeral: 'enums.category-ephemeral',
  'accountability-and-human-oversight':
    'enums.category-accountability-and-human-oversight',
  'bias-fairness-and-discrimination':
    'enums.category-bias-fairness-and-discrimination',
  cybersecurity: 'enums.category-cybersecurity',
  'data-and-data-governance': 'enums.category-data-and-data-governance',
  'ethics-and-human-rights': 'enums.category-ethics-and-human-rights',
  'privacy-and-data-protection': 'enums.category-privacy-and-data-protection',
  'safety-and-environmental-impact':
    'enums.category-safety-and-environmental-impact',
  'transparency-and-accessibility':
    'enums.category-transparency-and-accessibility',
} as const satisfies Record<EnumeratedCategory, string>;
