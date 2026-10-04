import {
  elementsById,
  flowEnds,
  generateThreatId,
  isEmptyName,
  nextThreatNumber,
  threatSchema,
  unlabelledFlow,
  type Diagram,
  type Element,
  type ElementId,
  type Threat,
  type ThreatId,
} from '@saerskriven/model';
import { flowEndsText, kindLabel } from '../canvas/names.js';
import type { StudioTranslator } from '../messages/catalogues.js';
import { diagramTitle } from '../messages/diagram-title.js';
import {
  headingKindMessages,
  severityMessages,
  statusMessages,
} from '../messages/enum-labels.js';
import { sentences, type Said } from '../messages/said.js';
import { Action } from '../store/actions.js';
import { selectedElement, selectedElementRecord } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { distinctTexts, optionName } from './distinct-labels.js';
import type { Choice } from './pick-existing.js';

const threatFields = threatSchema.keyof().options;

/** What an open panel shows: one or several selected elements, or the model. */
export type PanelSubject =
  | { readonly kind: 'element'; readonly element: Element }
  | { readonly kind: 'several'; readonly count: number }
  | { readonly kind: 'model' };

/** What the panel is bound to, and nothing while nothing is selected and the model panel is closed. */
export function panelSubject(state: State): PanelSubject | undefined {
  if (state.modelPanel) {
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

/** Every threat in the model, in register order, whatever it names. */
export function modelThreats(state: State): readonly Threat[] {
  return state.present.threats;
}

function unlabelledFlowEnds(
  element: Element,
  elements: ReadonlyMap<ElementId, Element>,
  t: StudioTranslator['t'],
): string | undefined {
  const flow = unlabelledFlow(element);
  return flow === undefined
    ? undefined
    : flowEndsText(flowEnds(flow, elements), t);
}

/**
 * What the panel calls an element: as {@link kindLabel} words it, and a flow
 * left unlabelled by its ends, "Flow from A to B".
 */
export function elementLabel(
  element: Element,
  elements: ReadonlyMap<ElementId, Element>,
  t: StudioTranslator['t'],
): string {
  const ends = unlabelledFlowEnds(element, elements, t);
  return ends === undefined
    ? kindLabel(element.name, element.kind, t)
    : t('panel.unlabelled-flow', { ends });
}

/**
 * What heads an element's panel: {@link elementLabel}, and for an element
 * without a name its kind worded to open a line, "The actor".
 */
export function elementHeading(
  element: Element,
  elements: ReadonlyMap<ElementId, Element>,
  t: StudioTranslator['t'],
): string {
  return element.kind !== 'flow' && isEmptyName(element.name)
    ? t(headingKindMessages[element.kind])
    : elementLabel(element, elements, t);
}

/**
 * An element as a list of choices offers it, under {@link elementLabel}. Only
 * an element whose kind stands in for its missing name counts as unnamed, so
 * a flow left unlabelled carries no id unless its ends repeat another's.
 */
export function labelledElement(
  element: Element,
  elements: ReadonlyMap<ElementId, Element>,
  t: StudioTranslator['t'],
): {
  readonly id: ElementId;
  readonly label: string;
  readonly unnamed: boolean;
} {
  return {
    id: element.id,
    label: elementLabel(element, elements, t),
    unnamed: isEmptyName(element.name) && unlabelledFlow(element) === undefined,
  };
}

/**
 * The threats "Attach existing" offers one element: every threat the register
 * holds that does not already name it, the ones attached to no element first,
 * each under a label a person can tell apart and a line giving its number,
 * severity, status, and that it applies to the model, or else that it hangs
 * off nothing, where it does.
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
    detachedFirst.map((threat) => {
      const unnamed = isEmptyName(threat.title);
      return {
        id: threat.id,
        label: unnamed ? '' : threat.title,
        unnamed,
        threat,
      };
    }),
  ).map(([{ threat }, text]) => ({
    id: threat.id,
    text: { ...text, detail: threatDetail(threat, t) },
  }));
}

/** Offers unattached elements with the title of the diagram that draws each one. */
export function attachableElements(
  diagrams: readonly Diagram[],
  threat: Threat,
  t: StudioTranslator['t'],
): readonly Choice<ElementId>[] {
  return distinctTexts(
    diagrams.flatMap((diagram) => {
      const elements = elementsById(diagram.elements);
      return diagram.elements
        .filter((element) => !threat.elements.includes(element.id))
        .map((element) => ({
          ...labelledElement(element, elements, t),
          detail: diagramTitle(diagram.title, t),
        }));
    }),
  ).map(([{ id, detail }, text]) => ({ id, text: { ...text, detail } }));
}

/**
 * What an attach says: the threat's number, and the element's kind with its
 * name where it has one, or for a flow left unlabelled its ends, which
 * `elements` holds.
 */
export function attachSaid(
  threat: Threat,
  on: Element,
  elements: ReadonlyMap<ElementId, Element>,
): Said {
  return elementSaid('attached-to', threat.number, on, elements);
}

/**
 * What a detach says, read from the model it left behind: the removal where
 * the threat went with its last element, and the detachment where the threat
 * stays, naming the element as {@link attachSaid} does and then what the
 * threat stays on, its other elements or, on none, the whole model. Nothing
 * at all where the detach did not land, which a refusal from a row the model
 * has moved on from looks like, so a refused edit is reported by its notice
 * alone.
 */
export function detachSaid(
  threat: Threat,
  detached: Element | undefined,
  kept: Threat | undefined,
  elements: ReadonlyMap<ElementId, Element>,
): Said | undefined {
  const { number } = threat;
  if (kept === undefined) {
    return removedSaid(threat);
  }
  if (detached === undefined || kept.elements.includes(detached.id)) {
    return undefined;
  }
  const from = elementSaid('detached-from', number, detached, elements);
  return (speak) =>
    sentences(
      from(speak),
      kept.elements.length > 0
        ? speak('canvas.threat-stays-on-elements')
        : kept.appliesToModel
          ? speak('canvas.threat-stays-on-model')
          : '',
    );
}

/**
 * What the edit that took a threat's last reference says: that the threat
 * went, and that undo restores it.
 */
export function removedSaid(threat: Pick<Threat, 'number'>): Said {
  const { number } = threat;
  return (speak) => speak('canvas.threat-detach-removed', { number });
}

function attachedElements(
  diagrams: readonly Diagram[],
  threat: Threat,
  t: StudioTranslator['t'],
) {
  return diagrams.flatMap((diagram) => {
    const elements = elementsById(diagram.elements);
    return diagram.elements
      .filter((element) => threat.elements.includes(element.id))
      .map((element) => {
        const ends = unlabelledFlowEnds(element, elements, t);
        return {
          ...labelledElement(element, elements, t),
          flowPhrase:
            ends === undefined
              ? undefined
              : t('panel.unlabelled-flow-phrase', { ends }),
        };
      });
  });
}

/** Flow labels stay stand-alone here, while Detach uses the shared flow phrase. */
export function threatAttachments(
  diagrams: readonly Diagram[],
  threat: Threat,
  t: StudioTranslator['t'],
): readonly {
  readonly id: ElementId;
  readonly label: string;
  readonly detach: string;
}[] {
  return distinctTexts(attachedElements(diagrams, threat, t)).map(
    ([{ id, label, flowPhrase }, text]) => ({
      id,
      label: optionName(text),
      detach: t('fields.detach-element', {
        element:
          flowPhrase === undefined || text.label !== label
            ? optionName(text)
            : optionName({ label: flowPhrase, suffix: text.suffix }),
      }),
    }),
  );
}

/** Summary names use noun phrases and distinguish collisions across those phrases. */
export function threatSummaryElements(
  diagrams: readonly Diagram[],
  threat: Threat,
  t: StudioTranslator['t'],
): readonly { readonly id: ElementId; readonly label: string }[] {
  return distinctTexts(
    attachedElements(diagrams, threat, t).map((element) => ({
      ...element,
      label: element.flowPhrase ?? element.label,
    })),
  ).map(([{ id }, text]) => ({ id, label: optionName(text) }));
}

/** The number the next threat added here takes, which the model issues. */
export function nextNumber(state: State): number {
  return nextThreatNumber(state.present);
}

/**
 * The threat an add starts from: undecided, open, STRIDE spoofing, attached
 * to `elementId`, or applying to the model where the add names no element.
 * Its title is written in the active locale at creation and is model content
 * from then on.
 */
export function freshThreat(
  number: number,
  elementId: ElementId | undefined,
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
    elements: elementId === undefined ? [] : [elementId],
    appliesToModel: elementId === undefined,
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

function elementSaid(
  change: 'attached-to' | 'detached-from',
  number: number,
  element: Element,
  elements: ReadonlyMap<ElementId, Element>,
): Said {
  const { name } = element;
  if (!isEmptyName(name)) {
    return (speak) =>
      speak(`canvas.threat-${change}-${element.kind}-named`, { number, name });
  }
  if (element.kind === 'flow') {
    const ends = flowEnds(element, elements);
    return (speak) =>
      speak(`canvas.threat-${change}-flow`, {
        number,
        ends: flowEndsText(ends, speak),
      });
  }
  const { kind } = element;
  return (speak) => speak(`canvas.threat-${change}-${kind}`, { number });
}

function threatDetail(threat: Threat, t: StudioTranslator['t']): string {
  return [
    t('panel.detail-threats', { count: 1, list: [String(threat.number)] }),
    t('panel.summary-severity', {
      severity: t(severityMessages[threat.severity]),
    }),
    t('panel.summary-status', { status: t(statusMessages[threat.status]) }),
    threat.appliesToModel
      ? t('panel.detail-applies-to-model')
      : threat.elements.length === 0 && t('panel.detail-no-elements'),
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
