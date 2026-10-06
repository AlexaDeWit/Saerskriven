import type { ThreatId } from '@saerskriven/model';
import { focusCanvas } from '../canvas/edits.js';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';
import { handlerSlot } from '../ui/handler-slot.js';

/** A threat asked for on the model panel, and what to call once the list has opened it. */
export type ThreatRequest = {
  readonly threatId: ThreatId;
  readonly opened: () => void;
};

/** A covered editor can refuse a different threat while it holds refused text. */
export type HiddenChoice = 'opened' | 'refused';

/** The model panel's focus target. */
export type ListFocus = 'summary' | 'refusal' | 'details';

/** The mounted editor answers requests without putting focus into model or undo state. */
export type ModelList = {
  readonly open: (request: ThreatRequest) => void;
  readonly showTab: () => void;
  readonly showDetails: () => void;
  readonly focus: (on: ListFocus) => void;
  readonly hidden: (threatId: ThreatId) => HiddenChoice | undefined;
};

const panelFocus = handlerSlot<() => boolean>();

const historyStep = handlerSlot<() => () => void>();

const modelList = handlerSlot<ModelList>();

let focusRequested = false;

let arriving: ThreatRequest | undefined;

/** Registers what moves focus into the mounted threat panel, and returns the removal. */
export const panelFocusHandler = panelFocus.register;

/** Moves focus into the threat panel, reopening it where Escape closed it, and answers whether a panel took it. */
export function focusThreatPanel(): boolean {
  return panelFocus.current()?.() ?? false;
}

/** Toggles the model editor, clearing selection on open and returning focus to the canvas on close. */
export function toggleModelPanel(): void {
  if (modelStore.getState().modelPanel) {
    hideModelPanel();
    return;
  }
  focusRequested = true;
  dispatch(Action.ShowModelPanel());
}

/** Closes the model panel and hands focus to the canvas. */
export function hideModelPanel(): void {
  dispatch(Action.HideModelPanel());
  focusCanvas();
}

/** Focuses the Threats tab through `focusTab` where {@link toggleModelPanel} opened the panel now mounting. */
export function takeModelPanelFocus(focusTab: () => void): void {
  if (focusRequested) {
    focusRequested = false;
    focusTab();
  }
}

/** Registers the mounted model panel's threat list, and returns the removal. */
export const modelListHandler = modelList.register;

/** Opens one threat immediately or after the editor mounts, unless another holds refused text. */
export function openInModelPanel(request: ThreatRequest): void {
  const list = shownList();
  if (list !== undefined) {
    list.open(request);
    return;
  }
  arriving = request;
  dispatch(Action.ShowModelPanel());
}

/** The request {@link openInModelPanel} left for the model panel's list to take as it mounts. */
export function arrivingThreat(): ThreatRequest | undefined {
  return arriving;
}

/** Forgets the request the mounting list has taken. */
export function settleArrivingThreat(): void {
  arriving = undefined;
}

/** Focuses the mounted editor, falling back to its Threats tab when no threat shows. */
export function focusModelPanel(on: ListFocus): boolean {
  const list = shownList();
  list?.focus(on);
  return list !== undefined;
}

/** Shows the Threats tab of the model panel where the panel shows. */
export function showModelThreats(): void {
  shownList()?.showTab();
}

/** Shows model metadata without replacing the chosen threat or its refused draft. */
export function showModelDetails(): void {
  shownList()?.showDetails();
}

/** Reads a covered editor's result from computed visibility, keeping the width rule in CSS. */
export function hiddenInModelPanel(
  threatId: ThreatId,
): HiddenChoice | undefined {
  return shownList()?.hidden(threatId);
}

/** Registers the threat panel's look at focus before an undo or redo, which returns how to settle it after. Returns the removal. */
export const historyFocusHandler = historyStep.register;

/** Runs an undo or redo step between the mounted threat panel's two looks at focus. */
export function stepHistory(step: () => void): void {
  const settle = historyStep.current()?.();
  step();
  settle?.();
}

function shownList(): ModelList | undefined {
  return modelStore.getState().modelPanel ? modelList.current() : undefined;
}
