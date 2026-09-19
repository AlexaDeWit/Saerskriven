import type {
  Element,
  Severity,
  Side,
  ThreatFlag,
  ThreatStatus,
} from '@saerskriven/model';
import type { EnumeratedCategory } from '@saerskriven/render';
import type { ColourMode } from '../theme-preference.js';
import type { StudioMessageId } from './catalogues.js';

type EnumMessageId = Extract<StudioMessageId, `${'terms' | 'enums'}.${string}`>;

export const severityMessages = {
  low: 'terms.severity-low',
  medium: 'terms.severity-medium',
  high: 'terms.severity-high',
  critical: 'terms.severity-critical',
  undecided: 'terms.severity-undecided',
} as const satisfies Record<Severity, EnumMessageId>;

export const statusMessages = {
  open: 'terms.status-open',
  mitigated: 'terms.status-mitigated',
  transferred: 'terms.status-transferred',
  avoided: 'terms.status-avoided',
  'accepted-risk': 'terms.status-accepted-risk',
  eliminated: 'terms.status-eliminated',
  'not-applicable': 'terms.status-not-applicable',
} as const satisfies Record<ThreatStatus, EnumMessageId>;

export const flagMessages = {
  'mitigated-without-implemented-work':
    'terms.flag-mitigated-without-implemented-work',
  'rests-on-invalidated-assumption':
    'terms.flag-rests-on-invalidated-assumption',
} as const satisfies Record<ThreatFlag, EnumMessageId>;

/** What an element is called in a sentence when it carries no name. */
export const articleKindMessages = {
  actor: 'enums.the-actor',
  process: 'enums.the-process',
  store: 'enums.the-store',
  text: 'enums.the-text',
  flow: 'enums.the-flow',
  'trust-boundary': 'enums.the-trust-boundary',
} as const satisfies Record<Element['kind'], EnumMessageId>;

export const kindMessages = {
  actor: 'enums.kind-actor',
  process: 'enums.kind-process',
  store: 'enums.kind-store',
  text: 'enums.kind-text',
  flow: 'enums.kind-flow',
  'trust-boundary': 'enums.kind-trust-boundary',
} as const satisfies Record<Element['kind'], EnumMessageId>;

export const sideMessages = {
  top: 'enums.side-top',
  right: 'enums.side-right',
  bottom: 'enums.side-bottom',
  left: 'enums.side-left',
} as const satisfies Record<Side, EnumMessageId>;

export const colourModeMessages = {
  system: 'enums.colour-system',
  light: 'enums.colour-light',
  dark: 'enums.colour-dark',
} as const satisfies Record<ColourMode, EnumMessageId>;

export const categoryMessages = {
  spoofing: 'terms.category-spoofing',
  tampering: 'terms.category-tampering',
  repudiation: 'terms.category-repudiation',
  'information-disclosure': 'terms.category-information-disclosure',
  'denial-of-service': 'terms.category-denial-of-service',
  'elevation-of-privilege': 'terms.category-elevation-of-privilege',
  linking: 'terms.category-linking',
  identifying: 'terms.category-identifying',
  'non-repudiation': 'terms.category-non-repudiation',
  detecting: 'terms.category-detecting',
  'data-disclosure': 'terms.category-data-disclosure',
  unawareness: 'terms.category-unawareness',
  'non-compliance': 'terms.category-non-compliance',
  confidentiality: 'terms.category-confidentiality',
  integrity: 'terms.category-integrity',
  availability: 'terms.category-availability',
  distributed: 'terms.category-distributed',
  immutable: 'terms.category-immutable',
  ephemeral: 'terms.category-ephemeral',
  'accountability-and-human-oversight':
    'terms.category-accountability-and-human-oversight',
  'bias-fairness-and-discrimination':
    'terms.category-bias-fairness-and-discrimination',
  cybersecurity: 'terms.category-cybersecurity',
  'data-and-data-governance': 'terms.category-data-and-data-governance',
  'ethics-and-human-rights': 'terms.category-ethics-and-human-rights',
  'privacy-and-data-protection': 'terms.category-privacy-and-data-protection',
  'safety-and-environmental-impact':
    'terms.category-safety-and-environmental-impact',
  'transparency-and-accessibility':
    'terms.category-transparency-and-accessibility',
} as const satisfies Record<EnumeratedCategory, EnumMessageId>;
