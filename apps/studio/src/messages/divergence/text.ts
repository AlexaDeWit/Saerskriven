import type {
  Divergence,
  DivergenceCode,
  DivergenceDetail,
} from '@saerskriven/formats';
import {
  elementsAcross,
  elementsById,
  inNumberOrder,
  mitigationStatusSchema,
  type Assumption,
  type AssumptionId,
  type Diagram,
  type DiagramId,
  type Element,
  type ElementId,
  type Mitigation,
  type MitigationId,
  type Model,
  type Threat,
  type ThreatId,
} from '@saerskriven/model';
import { unlabelledFlowEnds } from '../../panel/threats.js';
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
      readonly parameters: { readonly status: string };
    }
  | {
      readonly code: 'otm-mitigation-status-retained';
      readonly parameters: { readonly id: string; readonly status: string };
    };

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
 * Each loss as a line in the reader's language: its subject as `model` shows
 * it, then what was lost, and a sentence where saving back keeps it. A
 * subject `model` does not hold, and the model itself, leave the line to the
 * detail, which a code about the model words with its own subject.
 */
export function lossLines(
  t: Speaker,
  model: Model,
  losses: readonly Loss[],
): readonly string[] {
  const held = heldBy(model);
  return losses.map(({ divergence, kept }) => {
    const detail = lossDetail(t, divergence.detail, held);
    const subject = subjectText(t, held, divergence);
    const line =
      subject === undefined
        ? detail
        : t('divergence.line', { subject, detail });
    return kept ? t('divergence.kept', { line }) : line;
  });
}

type Held = {
  readonly diagrams: ReadonlyMap<DiagramId, Diagram>;
  readonly elements: ReadonlyMap<ElementId, Element>;
  readonly threats: ReadonlyMap<ThreatId, Threat>;
  readonly mitigations: ReadonlyMap<MitigationId, Mitigation>;
  readonly assumptions: ReadonlyMap<AssumptionId, Assumption>;
};

function heldBy(model: Model): Held {
  return {
    diagrams: new Map(model.diagrams.map((diagram) => [diagram.id, diagram])),
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
    const { status } = detail.parameters;
    return status === undefined
      ? undefined
      : { code: detail.code, parameters: { status } };
  }
  if (detail.code === 'otm-mitigation-status-retained') {
    const { id, status } = detail.parameters;
    return status === null || status === undefined
      ? undefined
      : { code: detail.code, parameters: { id, status } };
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
      return undefined;
    case 'diagram': {
      const diagram = held.diagrams.get(subject.id);
      return (
        diagram && t('divergence.subject-diagram', { title: diagram.title })
      );
    }
    case 'element': {
      const element = held.elements.get(subject.id);
      return element && elementSubject(t, element, held.elements);
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

function elementSubject(
  t: Speaker,
  element: Element,
  elements: ReadonlyMap<ElementId, Element>,
): string {
  if (element.kind === 'flow') {
    const ends = unlabelledFlowEnds(element, elements, t);
    return ends === undefined
      ? t('divergence.subject-flow-named', { name: element.name })
      : t('panel.unlabelled-flow', { ends });
  }
  return element.name === ''
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
  if (mitigation.title !== '') {
    return t('divergence.subject-mitigation', { title: mitigation.title });
  }
  const threat = threatHolding(mitigation, held, threatNamedBy(detail));
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
    detail.code === 'mitigation-status-dropped'
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
      return t('divergence.otm-threat-split', detail.parameters);
    case 'otm-threat-status-unmapped':
      return t('divergence.otm-threat-status-unmapped', detail.parameters);
    case 'otm-mitigation-split':
      return t('divergence.otm-mitigation-split', detail.parameters);
    case 'otm-mitigation-status-retained':
      return t('divergence.otm-mitigation-status-retained', detail.parameters);
    case 'otm-mitigation-unlinked':
      return t('divergence.otm-mitigation-unlinked', detail.parameters);
    case 'otm-assets-as-descriptions':
      return t('divergence.otm-assets-as-descriptions');
    case 'otm-components-as-processes':
      return t('divergence.otm-components-as-processes');
    case 'tmbom-control-proposed':
      return t('divergence.tmbom-control-proposed', detail.parameters);
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
  const name =
    [...held.elements.values()].find((candidate) => candidate.id === element)
      ?.name ?? '';
  return name === ''
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
