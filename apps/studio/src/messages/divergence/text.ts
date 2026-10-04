import {
  importedFrom,
  type Divergence,
  type DivergenceCode,
  type DivergenceDetail,
  type SourceNamedKind,
} from '@saerskriven/formats';
import {
  elementIdSchema,
  elementsAcross,
  elementsById,
  inNumberOrder,
  isEmptyName,
  mitigationStatusSchema,
  threatIdSchema,
  type Assumption,
  type AssumptionId,
  type Element,
  type ElementId,
  type Mitigation,
  type MitigationId,
  type Model,
  type Threat,
  type ThreatId,
} from '@saerskriven/model';
import { mitigationStatusMessages } from '../enum-labels.js';
import type { Speaker } from '../said.js';

const leftOutCodes = [
  'release-restamped',
  'threat-mark-raised-by-issue',
  'threat-mark-raised-to-issued',
  'diagram-mark-raised-by-issue',
  'diagram-mark-raised-to-issued',
  'diagram-name-numbered',
  'diagram-discarded',
  'threat-copy-detached',
  'threat-discarded',
  'cell-reshaped',
  'cell-discarded',
  'otm-threat-undecided',
  'otm-geometry-generated',
  'tmbom-threats-undecided',
  'tmbom-geometry-generated',
] as const satisfies readonly DivergenceCode[];

type LeftOutCode = (typeof leftOutCodes)[number];

type StatusCarried =
  | 'otm-threat-status-unmapped'
  | 'otm-mitigation-status-retained';

type ReportedDetail =
  | Exclude<DivergenceDetail, { readonly code: LeftOutCode | StatusCarried }>
  | {
      readonly code: 'otm-threat-status-unmapped';
      readonly parameters: {
        readonly status: string;
        readonly threat?: string;
      };
    }
  | {
      readonly code: 'otm-mitigation-status-retained';
      readonly parameters: {
        readonly id: string;
        readonly status: string;
        readonly threat?: string;
      };
    };

/**
 * The headings an open report lists its lines under, in the order it shows
 * them. Conversions come first: they are few and explain the model on screen,
 * where the fields a foreign file leaves unread can run past a hundred.
 */
export const openSections = ['converted', 'not-shown'] as const;

/**
 * One heading of an open report. `converted`: the model holds the value in
 * another form or another place than the file had it, so a person finds it
 * in the studio. A kind that converts and also loses falls here where the
 * value can still be found. `not-shown`: the model has no place for the
 * value, or holds it less exactly with nothing in the model saying so.
 */
export type OpenSection = (typeof openSections)[number];

const openPlacements = {
  'assumption-unrecorded': 'save-only',
  'note-name-dropped': 'save-only',
  'scope-marking-dropped': 'save-only',
  'threat-attachment-stray': 'save-only',
  'threat-unplaceable': 'save-only',
  'threat-model-link-dropped': 'save-only',
  'threat-split-across-elements': 'save-only',
  'threat-category-unnamed': 'save-only',
  'mitigation-records-merged': 'save-only',
  'mitigation-title-merged': 'save-only',
  'mitigation-empty-dropped': 'save-only',
  'mitigation-status-dropped': 'save-only',
  'mitigation-unlinked': 'save-only',
  'mitigation-split-across-threats': 'save-only',
  'threat-status-unmapped': 'not-shown',
  'threat-severity-unmapped': 'not-shown',
  'threat-category-eop-suit': 'not-shown',
  'threat-category-unmapped': 'converted',
  'key-undeclared': 'not-shown',
  'assumption-element-links-dropped': 'not-shown',
  'otm-threat-split': 'converted',
  'otm-threat-status-unmapped': 'converted',
  'otm-mitigation-split': 'converted',
  'otm-mitigation-status-retained': 'converted',
  'otm-mitigation-unlinked': 'converted',
  'otm-assets-as-descriptions': 'converted',
  'otm-components-as-processes': 'converted',
  'tmbom-control-proposed': 'converted',
  'tmbom-control-unlinked': 'converted',
  'tmbom-flow-fields-as-prose': 'converted',
  'tmbom-data-set-as-prose': 'converted',
  'tmbom-data-set-dropped': 'not-shown',
  'field-not-retained': 'not-shown',
} as const satisfies Record<ReportedDetail['code'], OpenSection | 'save-only'>;

/** A divergence a studio report shows, its detail one the catalogue words. */
export type ReportedDivergence = Omit<Divergence, 'detail'> & {
  readonly detail: ReportedDetail;
};

/** A divergence a report shows, and whether saving back to the same file keeps it. */
export type Loss = {
  readonly divergence: ReportedDivergence;
  readonly kept: boolean;
};

/**
 * `divergence` as a studio report shows it, or nothing where it loses
 * nothing a person reads: a number mark, a release stamp or a diagram id a
 * write replaced, what an edit already removed, and a default or a layout an
 * import supplied where the source held none. The command line and the MCP
 * server still report every divergence.
 */
export function reportedDivergence(
  divergence: Divergence,
): ReportedDivergence | undefined {
  const detail = reportedDetail(divergence.detail);
  return detail === undefined ? undefined : { ...divergence, detail };
}

/**
 * The heading an open report lists `divergence` under. A code only a save
 * records has no place of its own there and falls under `not-shown`.
 */
export function openSectionOf({ detail }: ReportedDivergence): OpenSection {
  const placed = openPlacements[detail.code];
  return placed === 'save-only' ? 'not-shown' : placed;
}

/**
 * Each loss as a line in the reader's language: its subject as `model` shows
 * it, then what was lost or what it became, and a sentence where saving back
 * keeps it. Losses that read the same make one line with their count. An
 * import names the threat a divergence carries, or the mitigation copy on it,
 * or else the first record made from the source record it names. A subject
 * `model` does not hold leaves the line to the detail, which a code about
 * the model alone words with its own subject.
 */
export function lossLines(
  t: Speaker,
  model: Model,
  losses: readonly Loss[],
): readonly string[] {
  const held = heldBy(model);
  const counted = new Map<
    string,
    { line: string; kept: boolean; count: number }
  >();
  for (const { divergence, kept } of losses) {
    const detail = lossDetail(t, divergence.detail, held);
    const subject = subjectText(t, held, divergence);
    const line =
      subject === undefined
        ? detail
        : t('divergence.line', { subject, detail });
    const key = `${String(kept)}:${line}`;
    const seen = counted.get(key);
    counted.set(key, { line, kept, count: (seen?.count ?? 0) + 1 });
  }
  return [...counted.values()].map(({ line, kept, count }) => {
    const once = t('divergence.repeated', { count, line });
    return kept ? t('divergence.kept', { line: once }) : once;
  });
}

type Held = {
  readonly elements: ReadonlyMap<ElementId, Element>;
  readonly threats: ReadonlyMap<ThreatId, Threat>;
  readonly mitigations: ReadonlyMap<MitigationId, Mitigation>;
  readonly assumptions: ReadonlyMap<AssumptionId, Assumption>;
};

function heldBy(model: Model): Held {
  return {
    elements: elementsById(elementsAcross(model.diagrams)),
    threats: new Map(model.threats.map((threat) => [threat.id, threat])),
    mitigations: new Map(
      model.mitigations.map((record) => [record.id, record]),
    ),
    assumptions: new Map(
      model.assumptions.map((record) => [record.id, record]),
    ),
  };
}

function reportedDetail(detail: DivergenceDetail): ReportedDetail | undefined {
  if (detail.code === 'otm-threat-status-unmapped') {
    const { status, threat } = detail.parameters;
    return status === undefined
      ? undefined
      : { code: detail.code, parameters: { status, threat } };
  }
  if (detail.code === 'otm-mitigation-status-retained') {
    const { id, status, threat } = detail.parameters;
    return status === null || status === undefined
      ? undefined
      : { code: detail.code, parameters: { id, status, threat } };
  }
  return isLeftOut(detail) ? undefined : detail;
}

function isLeftOut(
  detail: DivergenceDetail,
): detail is Extract<DivergenceDetail, { readonly code: LeftOutCode }> {
  return leftOutCodes.some((code) => code === detail.code);
}

function subjectText(
  t: Speaker,
  held: Held,
  { subject, detail }: ReportedDivergence,
): string | undefined {
  switch (subject.kind) {
    case 'model':
      return importedSubject(t, held, detail);
    case 'diagram':
      return undefined;
    case 'element': {
      const element = held.elements.get(subject.id);
      return element?.kind === 'text' || element?.kind === 'trust-boundary'
        ? elementSubject(t, element)
        : undefined;
    }
    case 'threat': {
      const threat = held.threats.get(subject.id);
      return threat && threatSubject(t, threat);
    }
    case 'mitigation': {
      const mitigation = held.mitigations.get(subject.id);
      return mitigation && mitigationSubject(t, mitigation, held, detail);
    }
    case 'assumption': {
      const assumption = held.assumptions.get(subject.id);
      return assumption && assumptionSubject(t, assumption, held);
    }
    default:
      return unnamed(subject);
  }
}

function importedSubject(
  t: Speaker,
  held: Held,
  detail: ReportedDetail,
): string | undefined {
  if (detail.code === 'otm-threat-split') {
    return threatMadeFrom(t, held, detail.parameters.id);
  }
  if (detail.code === 'otm-threat-status-unmapped') {
    const made = threatIdSchema.safeParse(detail.parameters.threat);
    const threat = made.success ? held.threats.get(made.data) : undefined;
    return threat && threatSubject(t, threat);
  }
  if (
    detail.code === 'otm-mitigation-split' ||
    detail.code === 'otm-mitigation-status-retained'
  ) {
    return mitigationMadeFrom(
      t,
      held,
      detail,
      'otm-mitigation',
      detail.parameters.id,
    );
  }
  return detail.code === 'tmbom-control-proposed'
    ? mitigationMadeFrom(
        t,
        held,
        detail,
        'tmbom-control',
        detail.parameters.name,
      )
    : undefined;
}

function threatMadeFrom(
  t: Speaker,
  held: Held,
  source: string,
): string | undefined {
  const threat = inNumberOrder([...held.threats.values()]).find(({ id }) =>
    importedFrom(id, 'otm-threat', source),
  );
  return threat && threatSubject(t, threat);
}

function mitigationMadeFrom(
  t: Speaker,
  held: Held,
  detail: ReportedDetail,
  kind: SourceNamedKind,
  source: string,
): string | undefined {
  const named = threatNamedBy(detail);
  const mitigation = [...held.mitigations.values()].find(
    ({ id, threats }) =>
      importedFrom(id, kind, source) &&
      (named === undefined || threats.some((threat) => threat === named)),
  );
  return mitigation && mitigationSubject(t, mitigation, held, detail);
}

function elementSubject(
  t: Speaker,
  element: Extract<Element, { readonly kind: 'text' | 'trust-boundary' }>,
): string {
  return isEmptyName(element.name)
    ? t(`divergence.subject-${element.kind}`)
    : t(`divergence.subject-${element.kind}-named`, { name: element.name });
}

function threatSubject(t: Speaker, { number, title }: Threat): string {
  return title === ''
    ? t('divergence.subject-threat-untitled', { number })
    : t('divergence.subject-threat', { number, title });
}

function threatPhrase(t: Speaker, { number, title }: Threat): string {
  return title === ''
    ? t('divergence.threat-untitled', { number })
    : t('divergence.threat', { number, title });
}

function mitigationSubject(
  t: Speaker,
  mitigation: Mitigation,
  held: Held,
  detail: ReportedDetail,
): string {
  const named = threatNamedBy(detail);
  const threat = threatHolding(mitigation, held, named);
  if (mitigation.title !== '') {
    return threat !== undefined && threat.id === named
      ? t('divergence.subject-mitigation-titled-on', {
          title: mitigation.title,
          threat: threatPhrase(t, threat),
        })
      : t('divergence.subject-mitigation', { title: mitigation.title });
  }
  return threat === undefined
    ? t('divergence.subject-mitigation-untitled')
    : t('divergence.subject-mitigation-on', {
        threat: threatPhrase(t, threat),
      });
}

function assumptionSubject(
  t: Speaker,
  assumption: Assumption,
  held: Held,
): string {
  const threat = threatHolding(assumption, held);
  if (threat !== undefined) {
    return t('divergence.subject-assumption-on', {
      threat: threatPhrase(t, threat),
    });
  }
  return assumption.appliesToModel
    ? t('divergence.subject-assumption-on-model')
    : t('divergence.subject-assumption');
}

function threatNamedBy(detail: ReportedDetail): string | undefined {
  return detail.code === 'mitigation-empty-dropped' ||
    detail.code === 'mitigation-status-dropped' ||
    detail.code === 'otm-mitigation-status-retained'
    ? detail.parameters.threat
    : undefined;
}

function threatHolding(
  record: { readonly threats: readonly ThreatId[] },
  held: Held,
  named?: string,
): Threat | undefined {
  const holding = record.threats.flatMap((id) => held.threats.get(id) ?? []);
  return (
    holding.find((threat) => threat.id === named) ?? inNumberOrder(holding)[0]
  );
}

function lossDetail(t: Speaker, detail: ReportedDetail, held: Held): string {
  switch (detail.code) {
    case 'assumption-unrecorded':
      return t('divergence.whole-assumption');
    case 'note-name-dropped':
      return t('divergence.note-name-dropped');
    case 'scope-marking-dropped':
      return t('divergence.scope-marking-dropped');
    case 'threat-attachment-stray':
      return strayAttachment(t, detail.parameters, held);
    case 'threat-unplaceable':
      return t('divergence.whole-threat');
    case 'threat-model-link-dropped':
      return t('divergence.threat-model-link-dropped');
    case 'threat-split-across-elements':
      return t('divergence.split-into-copies', detail.parameters);
    case 'threat-category-unnamed':
      return t('divergence.threat-category-unnamed');
    case 'mitigation-records-merged':
      return t('divergence.mitigation-records-merged', detail.parameters);
    case 'mitigation-title-merged':
      return t('divergence.mitigation-title-merged');
    case 'mitigation-empty-dropped':
      return t('divergence.whole-mitigation');
    case 'mitigation-status-dropped':
      return t('divergence.mitigation-status-dropped', {
        status: statusLabel(t, detail.parameters.status),
        inferred: statusLabel(t, detail.parameters.inferred),
      });
    case 'mitigation-unlinked':
      return t('divergence.whole-mitigation');
    case 'mitigation-split-across-threats':
      return t('divergence.split-into-copies', detail.parameters);
    case 'threat-status-unmapped':
      return t('divergence.threat-status-unmapped', detail.parameters);
    case 'threat-severity-unmapped':
      return t('divergence.threat-severity-unmapped', detail.parameters);
    case 'threat-category-eop-suit':
      return t('divergence.threat-category-eop-suit');
    case 'threat-category-unmapped':
      return t('divergence.threat-category-unmapped', detail.parameters);
    case 'key-undeclared':
      return t('divergence.key-undeclared', detail.parameters);
    case 'assumption-element-links-dropped':
      return t('divergence.assumption-element-links-dropped');
    case 'otm-threat-split':
      return t('divergence.otm-threat-split');
    case 'otm-threat-status-unmapped':
      return t('divergence.otm-threat-status-unmapped', {
        status: detail.parameters.status,
      });
    case 'otm-mitigation-split':
      return t('divergence.otm-mitigation-split');
    case 'otm-mitigation-status-retained':
      return t('divergence.otm-mitigation-status-retained', {
        status: detail.parameters.status,
      });
    case 'otm-mitigation-unlinked':
      return t('divergence.otm-mitigation-unlinked', detail.parameters);
    case 'otm-assets-as-descriptions':
      return t('divergence.otm-assets-as-descriptions');
    case 'otm-components-as-processes':
      return t('divergence.otm-components-as-processes');
    case 'tmbom-control-proposed':
      return t('divergence.tmbom-control-proposed');
    case 'tmbom-control-unlinked':
      return t('divergence.tmbom-control-unlinked', detail.parameters);
    case 'tmbom-flow-fields-as-prose':
      return t('divergence.tmbom-flow-fields-as-prose');
    case 'tmbom-data-set-as-prose':
      return t('divergence.tmbom-data-set-as-prose', detail.parameters);
    case 'tmbom-data-set-dropped':
      return t('divergence.tmbom-data-set-dropped', detail.parameters);
    case 'field-not-retained':
      return t('divergence.field-not-retained', {
        path: detail.parameters.path.join('.'),
      });
    default:
      return undescribed(detail);
  }
}

function strayAttachment(
  t: Speaker,
  {
    element,
    kind,
  }: Extract<
    DivergenceDetail,
    { readonly code: 'threat-attachment-stray' }
  >['parameters'],
  held: Held,
): string {
  if (kind === undefined) {
    return t('divergence.threat-attachment-stray-unknown');
  }
  const id = elementIdSchema.safeParse(element);
  const name = id.success ? (held.elements.get(id.data)?.name ?? '') : '';
  return isEmptyName(name)
    ? t(`divergence.threat-attachment-stray-${kind}`)
    : t(`divergence.threat-attachment-stray-${kind}-named`, { name });
}

function statusLabel(t: Speaker, status: string): string {
  const stored = mitigationStatusSchema.safeParse(status);
  return stored.success ? t(mitigationStatusMessages[stored.data]) : status;
}

function undescribed(_detail: never): string {
  return '';
}

function unnamed(_subject: never): string | undefined {
  return undefined;
}
