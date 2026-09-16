import {
  ciaCategorySchema,
  ciaDieCategorySchema,
  linddunCategorySchema,
  severitySchema,
  strideCategorySchema,
  threatStatusSchema,
  type CiaCategory,
  type CiaDieCategory,
  type CustomCategory,
  type LinddunCategory,
  type Severity,
  type StrideCategory,
  type ThreatCategory,
  type ThreatStatus,
} from '@saerskriven/model';
import type { ThreatDragonThreat } from '@saerskriven/wire-threat-dragon';
import { categoryTranslations } from './threat-dragon-locales.js';

/**
 * The fields of a Threat Dragon threat that name its category: the
 * methodology, the label in its author's language, and an Elevation of
 * Privilege card's suit. A write reads its own projection back through these.
 */
export type ThreatDragonCategoryFields = Pick<
  ThreatDragonThreat,
  'modelType' | 'type' | 'cardSuit'
>;

/**
 * A Threat Dragon value as the model holds it. `exact` is false where the
 * codec fell back, which a read reports as a divergence.
 */
export type Reading<Value> = {
  readonly value: Value;
  readonly exact: boolean;
};

const unspecified = 'unspecified';

const eop = 'EOP';

const statusLabels = {
  open: 'Open',
  mitigated: 'Mitigated',
  transferred: 'Transferred',
  avoided: 'Avoided',
  'accepted-risk': 'Accepted',
  eliminated: 'Eliminated',
  'not-applicable': 'NotApplicable',
} as const satisfies Record<ThreatStatus, string>;

const undecidedAlias = 'TBA';

const severityLabels = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
  undecided: 'TBD',
} as const satisfies Record<Severity, string>;

const strideCategories = strideCategorySchema.shape.category.options;

const strideLabels = {
  spoofing: 'Spoofing',
  tampering: 'Tampering',
  repudiation: 'Repudiation',
  'information-disclosure': 'Information disclosure',
  'denial-of-service': 'Denial of service',
  'elevation-of-privilege': 'Elevation of privilege',
} as const satisfies Record<StrideCategory['category'], string>;

const linddunCategories = linddunCategorySchema.shape.category.options;

const linddunLabels = {
  linking: 'Linkability',
  identifying: 'Identifiability',
  'non-repudiation': 'Non-repudiation',
  detecting: 'Detectability',
  'data-disclosure': 'Disclosure of information',
  unawareness: 'Unawareness',
  'non-compliance': 'Non-compliance',
} as const satisfies Record<LinddunCategory['category'], string>;

const ciaCategories = ciaCategorySchema.shape.category.options;

const ciaLabels = {
  confidentiality: 'Confidentiality',
  integrity: 'Integrity',
  availability: 'Availability',
} as const satisfies Record<CiaCategory['category'], string>;

const ciaDieCategories = ciaDieCategorySchema.shape.category.options;

const ciaDieLabels = {
  ...ciaLabels,
  distributed: 'Distributed',
  immutable: 'Immutable',
  ephemeral: 'Ephemeral',
} as const satisfies Record<CiaDieCategory['category'], string>;

const ciaDieTranslations = {
  ...categoryTranslations.cia,
  ...categoryTranslations.die,
};

const enumeratedCategories: Readonly<
  Record<string, (label: string) => ThreatCategory | undefined>
> = {
  STRIDE: (label) =>
    paired(
      'STRIDE',
      resolve(
        strideCategories,
        strideLabels,
        categoryTranslations.stride,
        label,
      ),
    ),
  LINDDUN: (label) =>
    paired(
      'LINDDUN',
      resolve(
        linddunCategories,
        linddunLabels,
        categoryTranslations.linddun,
        label,
      ),
    ),
  CIA: (label) =>
    paired(
      'CIA',
      resolve(ciaCategories, ciaLabels, categoryTranslations.cia, label),
    ),
  CIADIE: ciaDieCategory,
  DIE: ciaDieCategory,
};

/**
 * A Threat Dragon status as the model's own, read back through the table
 * {@link fromThreatStatus} writes with. An unknown status reads as `open`, not
 * exact.
 */
export function toThreatStatus(status: string): Reading<ThreatStatus> {
  const known = readBack(threatStatusSchema.options, statusLabels, status);
  return { value: known ?? 'open', exact: known !== undefined };
}

/**
 * A Threat Dragon severity as the model's own. `TBA`, which a Threat Dragon
 * demo model uses, is an alias of `undecided`, and an unknown severity reads
 * as `undecided`, not exact.
 */
export function toSeverity(severity: string): Reading<Severity> {
  const known =
    severity === undecidedAlias
      ? 'undecided'
      : readBack(severitySchema.options, severityLabels, severity);
  return { value: known ?? 'undecided', exact: known !== undefined };
}

/**
 * A Threat Dragon threat's methodology and category as the model's own. A
 * label is first translated from the language Threat Dragon wrote it in, a
 * LINDDUN label is Threat Dragon's older name for the model's category, and
 * `DIE` is an alias of `CIADIE`. Any other methodology becomes an exact
 * custom category with Threat Dragon's names unchanged, `default` included.
 * Not exact: an enumerated methodology whose label no language names, which
 * falls to custom, and an Elevation of Privilege card, of which the model
 * holds the suit alone. A missing methodology or label reads as
 * `unspecified`.
 */
export function toThreatCategory(
  threat: ThreatDragonCategoryFields,
): Reading<ThreatCategory> {
  const methodology = threat.modelType ?? unspecified;
  if (methodology === eop) {
    return {
      value: custom(methodology, threat.cardSuit ?? unspecified),
      exact: false,
    };
  }
  const label = threat.type ?? unspecified;
  const enumerated = lookup(enumeratedCategories, methodology);
  if (enumerated === undefined) {
    return { value: custom(methodology, label), exact: true };
  }
  const category = enumerated(label);
  return category === undefined
    ? { value: custom(methodology, label), exact: false }
    : { value: category, exact: true };
}

/** The model's status as Threat Dragon spells it. */
export function fromThreatStatus(status: ThreatStatus): string {
  return statusLabels[status];
}

/**
 * The model's severity as Threat Dragon spells it, `undecided` as `TBD`, the
 * spelling Threat Dragon's editor offers.
 */
export function fromSeverity(severity: Severity): string {
  return severityLabels[severity];
}

/**
 * The model's category as a Threat Dragon threat names it, enumerated
 * methodologies in Threat Dragon's English labels. An Elevation of Privilege
 * category writes its suit to `cardSuit` and a null `type`. Two do not read
 * back as written, which {@link toThreatCategory} shows: a PLOT4ai label,
 * since Threat Dragon ships a different PLOT4ai set, and a custom category
 * whose methodology name Threat Dragon enumerates.
 */
export function fromThreatCategory(
  category: ThreatCategory,
): ThreatDragonCategoryFields {
  if (category.methodology === 'STRIDE') {
    return { modelType: 'STRIDE', type: strideLabels[category.category] };
  }
  if (category.methodology === 'LINDDUN') {
    return { modelType: 'LINDDUN', type: linddunLabels[category.category] };
  }
  if (category.methodology === 'CIA') {
    return { modelType: 'CIA', type: ciaLabels[category.category] };
  }
  if (category.methodology === 'CIA-DIE') {
    return { modelType: 'CIADIE', type: ciaDieLabels[category.category] };
  }
  if (category.methodology === 'PLOT4ai') {
    return { modelType: 'PLOT4ai', type: category.category };
  }
  return category.methodologyName === eop
    ? { modelType: eop, type: null, cardSuit: category.category }
    : { modelType: category.methodologyName, type: category.category };
}

function ciaDieCategory(label: string): ThreatCategory | undefined {
  return paired(
    'CIA-DIE',
    resolve(ciaDieCategories, ciaDieLabels, ciaDieTranslations, label),
  );
}

function custom(methodologyName: string, category: string): CustomCategory {
  return { methodology: 'custom', methodologyName, category };
}

function paired<Methodology extends ThreatCategory['methodology'], Category>(
  methodology: Methodology,
  category: Category | undefined,
): { methodology: Methodology; category: Category } | undefined {
  return category === undefined ? undefined : { methodology, category };
}

function resolve<Category extends string>(
  categories: readonly Category[],
  labels: Readonly<Record<Category, string>>,
  translations: Readonly<Record<string, string>>,
  label: string,
): Category | undefined {
  return readBack(categories, labels, lookup(translations, label) ?? label);
}

function readBack<Value extends string>(
  values: readonly Value[],
  labels: Readonly<Record<Value, string>>,
  label: string,
): Value | undefined {
  return values.find((value) => labels[value] === label);
}

function lookup<Value>(
  table: Readonly<Record<string, Value>>,
  key: string,
): Value | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}
