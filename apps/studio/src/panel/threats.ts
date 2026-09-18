import {
  generateThreatId,
  nextThreatNumber,
  threatSchema,
  type Element,
  type ElementId,
  type Threat,
  type ThreatId,
} from '@saerskriven/model';
import { kindLabel } from '../canvas/names.js';
import type { StudioTranslator } from '../messages/catalogues.js';
import { Action } from '../store/actions.js';
import { selectedElement, selectedElementRecord } from '../store/selectors.js';
import type { State } from '../store/state.js';

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
