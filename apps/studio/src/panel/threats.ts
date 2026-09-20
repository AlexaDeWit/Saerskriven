import {
  generateThreatId,
  nextThreatNumber,
  threatSchema,
  type Diagram,
  type Element,
  type ElementId,
  type Threat,
  type ThreatId,
} from '@saerskriven/model';
import { kindLabel } from '../canvas/names.js';
import type { StudioTranslator } from '../messages/catalogues.js';
import { severityMessages, statusMessages } from '../messages/enum-labels.js';
import { Action } from '../store/actions.js';
import { selectedElement, selectedElementRecord } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { distinctTexts, optionName } from './distinct-labels.js';
import type { Choice } from './pick-existing.js';

const threatFields = threatSchema.keyof().options;

/** What an open panel shows: one or several selected elements, or the model's own properties. */
export type PanelSubject =
  | { readonly kind: 'element'; readonly element: Element }
  | { readonly kind: 'several'; readonly count: number }
  | { readonly kind: 'model' };

/** What the panel is bound to, and nothing while nothing is selected and the model's properties are hidden. */
export function panelSubject(state: State): PanelSubject | undefined {
  if (state.modelProperties) {
    return { kind: 'model' };
  }
  const selected = state.selection;
  if (selected.length > 1) {
    return { kind: 'several', count: selected.length };
  }
  const element = selectedElementRecord(state);
  return element === undefined ? undefined : { kind: 'element', element };
}

/** The name of the open file, which the panel's held drafts are kept against. */
export function openFileName(state: State): string | undefined {
  return state.file._tag === 'Opened' ? state.file.name : undefined;
}

/**
 * Every threat naming the selected element in register order, whatever its
 * status. The array is rebuilt on every call, so read it through `useShallow`.
 */
export function attachedThreats(state: State): readonly Threat[] {
  const selected = selectedElement(state);
  return selected === undefined
    ? []
    : state.present.threats.filter((threat) =>
        threat.elements.includes(selected),
      );
}

/** What the panel calls an element, as {@link kindLabel} words it. */
export function elementLabel(
  element: Element,
  t: StudioTranslator['t'],
): string {
  return kindLabel(element.name, element.kind, t);
}

/**
 * The threats "Attach existing" offers one element: every threat the register
 * holds that does not already name it, the ones attached to no element first,
 * each under a label a person can tell apart and a line giving its number,
 * severity, status, and that it hangs off nothing where it does.
 */
export function attachableThreats(
  registered: readonly Threat[],
  elementId: ElementId,
  { t }: StudioTranslator,
): readonly Choice<ThreatId>[] {
  const offered = registered.filter(
    (threat) => !threat.elements.includes(elementId),
  );
  const detachedFirst = [
    ...offered.filter((threat) => threat.elements.length === 0),
    ...offered.filter((threat) => threat.elements.length > 0),
  ];
  return distinctTexts(
    detachedFirst.map((threat) => ({
      id: threat.id,
      label: threat.title,
      unnamed: threat.title === '',
      threat,
    })),
  ).map(([{ threat }, text]) => ({
    id: threat.id,
    text: { ...text, detail: threatDetail(threat, t) },
  }));
}

/**
 * The elements "Attach existing" offers one threat: every element across the
 * diagrams that the threat does not already name, under the diagram drawing it.
 */
export function attachableElements(
  diagrams: readonly Diagram[],
  threat: Threat,
  t: StudioTranslator['t'],
): readonly Choice<ElementId>[] {
  return distinctTexts(
    diagrams.flatMap((diagram) =>
      diagram.elements
        .filter((element) => !threat.elements.includes(element.id))
        .map((element) => ({
          ...labelled(element, t),
          detail: diagram.title,
        })),
    ),
  ).map(([{ id, detail }, text]) => ({ id, text: { ...text, detail } }));
}

/** The elements one threat names, in diagram order, under labels a person can tell apart. */
export function threatAttachments(
  diagrams: readonly Diagram[],
  threat: Threat,
  t: StudioTranslator['t'],
): readonly { readonly id: ElementId; readonly label: string }[] {
  return distinctTexts(
    diagrams.flatMap((diagram) =>
      diagram.elements
        .filter((element) => threat.elements.includes(element.id))
        .map((element) => labelled(element, t)),
    ),
  ).map(([{ id }, text]) => ({ id, label: optionName(text) }));
}

/** The number the next threat added here takes, which the model issues. */
export function nextNumber(state: State): number {
  return nextThreatNumber(state.present);
}

/**
 * The threat an add starts from: undecided, open, STRIDE spoofing, attached
 * to `elementId`. Its title is written in the active locale at creation and
 * is model content from then on.
 */
export function freshThreat(
  number: number,
  elementId: ElementId,
  t: StudioTranslator['t'],
): Threat {
  return {
    id: generateThreatId(),
    number,
    title: t('defaults.new-threat'),
    category: { methodology: 'STRIDE', category: 'spoofing' },
    severity: 'undecided',
    status: 'open',
    description: '',
    elements: [elementId],
  };
}

/** The threat focused once `deleted` is gone: the next, else the previous, else none. */
export function threatAfterDeleting(
  threats: readonly Threat[],
  deleted: ThreatId,
): ThreatId | undefined {
  const index = threats.findIndex((threat) => threat.id === deleted);
  if (index < 0) {
    return undefined;
  }
  const next =
    threats.at(index + 1) ?? (index > 0 ? threats.at(index - 1) : undefined);
  return next?.id;
}

function labelled(
  element: Element,
  t: StudioTranslator['t'],
): {
  readonly id: ElementId;
  readonly label: string;
  readonly unnamed: boolean;
} {
  return {
    id: element.id,
    label: elementLabel(element, t),
    unnamed: element.name === '',
  };
}

function threatDetail(threat: Threat, t: StudioTranslator['t']): string {
  return [
    t('panel.detail-threats', { count: 1, list: [String(threat.number)] }),
    t('panel.summary-severity', {
      severity: t(severityMessages[threat.severity]),
    }),
    t('panel.summary-status', { status: t(statusMessages[threat.status]) }),
    threat.elements.length === 0 && t('panel.detail-no-elements'),
  ]
    .filter((part) => part !== false)
    .join(', ');
}

/**
 * The panel's commit handler for one threat, sending a patch as one
 * `ReplaceThreat`. A patch leaving every field identical dispatches nothing.
 */
export function threatCommitter(
  send: (action: Action) => void,
  threat: Threat | undefined,
): (patch: Partial<Threat>) => void {
  return (patch) => {
    if (threat === undefined) {
      return;
    }
    const edited = { ...threat, ...patch };
    if (threatFields.some((field) => edited[field] !== threat[field])) {
      send(Action.ReplaceThreat({ threat: edited }));
    }
  };
}
