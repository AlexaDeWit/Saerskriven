import type { BadgeMarks } from '@saerskriven/canvas';
import type { Locale } from '@saerskriven/i18n';
import type {
  AssumptionStatus,
  CustomCategory,
  MitigationStatus,
  Severity,
  ThreatCategory,
  ThreatFlag,
  ThreatStatus,
} from '@saerskriven/model';
import { exportText } from '../messages/catalogues.js';
import type { RegisterBadge } from './register-badges.js';

/** A category the model enumerates, as opposed to one an author named. */
export type EnumeratedCategory = Exclude<
  ThreatCategory,
  CustomCategory
>['category'];

/**
 * The words one locale's exports show the model's stored values under, and
 * the marks its threat badges draw, for an app that shows the same terms on
 * screen. A category an author named is content and has no term.
 */
export type RenderTerms = {
  readonly severity: (value: Severity) => string;
  readonly status: (value: ThreatStatus) => string;
  readonly mitigation: (value: MitigationStatus) => string;
  readonly assumption: (value: AssumptionStatus) => string;
  readonly flag: (value: ThreatFlag) => string;
  readonly category: (category: EnumeratedCategory) => string;
  readonly marks: BadgeMarks;
};

/** The terms of `locale`'s exports. */
export function renderTerms(locale: Locale): RenderTerms {
  const { t } = exportText(locale);
  return {
    severity: (value) => t(`terms.severity-${value}`),
    status: (value) => t(`terms.status-${value}`),
    mitigation: (value) => t(`terms.mitigation-${value}`),
    assumption: (value) => t(`terms.assumption-${value}`),
    flag: (value) => t(`terms.flag-${value}`),
    category: (category) => t(`terms.category-${category}`),
    marks: {
      severity: {
        undecided: t('terms.mark-undecided'),
        low: t('terms.mark-low'),
        medium: t('terms.mark-medium'),
        high: t('terms.mark-high'),
        critical: t('terms.mark-critical'),
      },
      flag: t('terms.mark-flag'),
    },
  };
}

/** The label a register badge reads as. */
export function badgeLabel(badge: RegisterBadge, terms: RenderTerms): string {
  if (badge.kind === 'severity') {
    return terms.severity(badge.value);
  }
  if (badge.kind === 'status') {
    return terms.status(badge.value);
  }
  if (badge.kind === 'mitigation') {
    return terms.mitigation(badge.value);
  }
  if (badge.kind === 'assumption') {
    return terms.assumption(badge.value);
  }
  return terms.flag(badge.value);
}

/**
 * A category's label followed by its methodology in parentheses. An author's
 * own category and methodology names pass through as written.
 */
export function categoryLabel(
  category: ThreatCategory,
  terms: RenderTerms,
): string {
  return category.methodology === 'custom'
    ? `${category.category} (${category.methodologyName})`
    : `${terms.category(category.category)} (${category.methodology})`;
}
