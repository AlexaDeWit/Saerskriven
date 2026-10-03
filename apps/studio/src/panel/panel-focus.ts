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

/**
 * What a model panel that styles hide did with a threat asked for: opened
 * it, or refused it for the refused text another threat holds.
 */
export type HiddenChoice = 'opened' | 'refused';

/** Where focus lands in the model panel's list: on the open threat's summary, or on the field holding refused text. */
export type ListFocus = 'summary' | 'refusal';

/**
 * What the mounted model panel's threat list answers to from outside it.
 * `showTab` shows the tab the list is on, and `hidden` is what the list did
 * with that threat where styles hide the panel.
 */
export type ModelList = {
  readonly open: (request: ThreatRequest) => void;
  readonly showTab: () => void;
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

/**
 * Opens the model panel on its Threats tab with focus on that tab, clearing
 * the canvas selection, or closes it with focus on the canvas where it
 * already shows.
 */
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

/**
 * Opens a threat on the model panel's Threats tab, showing the panel where it
 * is hidden, which clears the selection. The list calls `opened` once it has
 * opened the threat, and never where a refused draft holds another open.
 */
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

/**
 * Moves focus into the model panel where it shows, and answers whether it
 * did. Focus lands where `on` asks, on the open threat's summary where no
 * field holds refused text, and on the Threats tab where no threat shows.
 */
export function focusModelPanel(on: ListFocus): boolean {
  const list = shownList();
  list?.focus(on);
  return list !== undefined;
}

/** Shows the Threats tab of the model panel where the panel shows. */
export function showModelThreats(): void {
  shownList()?.showTab();
}

/**
 * What the model panel did with that threat out of sight: hidden by the
 * styles of a pane drawn over the panel, as the threat register's hide it in
 * a window too narrow for both. It answers nothing where the panel shows.
 * The answer is read from the panel as it is drawn, so it holds no width of
 * its own.
 */
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
