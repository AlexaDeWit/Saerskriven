import { resizeKeys } from '@saerskriven/canvas';
import type { Locale } from '@saerskriven/i18n';
import { useStoreApi } from '@xyflow/react';
import { useImperativeHandle, type KeyboardEvent, type Ref } from 'react';
import type { StudioTranslator } from '../messages/catalogues.js';
import { useTranslator } from '../messages/locale.js';
import type { State } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { currentLayout, selectionPosition } from './layout.js';

/** Hands on a keydown that has already passed React Flow's own node handler. */
export type KeyboardMoveReport = (event: KeyboardEvent) => void;

/**
 * A coordinate as Position and size shows it: the stored number, neither
 * rounded nor grouped, written with the locale's decimal sign.
 */
export function coordinateText(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 20,
    useGrouping: false,
  }).format(value);
}

/**
 * What the canvas says once an arrow key has moved the selection: where
 * Position and size now places it. Nothing while no element is selected.
 */
export function movedSelectionMessage(
  state: Pick<State, 'present' | 'activeDiagram' | 'selection'>,
  { locale, t }: StudioTranslator,
): string | undefined {
  const at = selectionPosition(currentLayout(state), state.selection);
  return at === undefined
    ? undefined
    : t('canvas.node-moved', {
        x: coordinateText(locale, at.x),
        y: coordinateText(locale, at.y),
      });
}

/**
 * React Flow's own move message, left blank: React Flow writes it from the
 * position before the move, truncated, and `KeyboardMoveMessage` writes the
 * message once the move has landed.
 */
export const preMoveMessage = (): string => '';

/**
 * Writes React Flow's live region after an arrow key on a focused node has
 * moved the selection. The canvas wrapper hands `ref` each keydown once React
 * Flow's node handler has run, so the store already holds the move. Mounted
 * inside `ReactFlow`, where its store is in reach.
 */
export function KeyboardMoveMessage({
  ref,
}: {
  readonly ref: Ref<KeyboardMoveReport>;
}): null {
  const flow = useStoreApi();
  const translator = useTranslator();
  useImperativeHandle(
    ref,
    () => (event: KeyboardEvent) => {
      if (!event.defaultPrevented || !onFocusedNode(event)) {
        return;
      }
      const message = movedSelectionMessage(modelStore.getState(), translator);
      if (message !== undefined) {
        flow.setState({ ariaLiveMessage: message });
      }
    },
    [flow, translator],
  );
  return null;
}

function onFocusedNode(event: KeyboardEvent): boolean {
  return (
    resizeKeys.some((key) => key === event.key) &&
    event.target instanceof Element &&
    event.target.matches('.react-flow__node')
  );
}
