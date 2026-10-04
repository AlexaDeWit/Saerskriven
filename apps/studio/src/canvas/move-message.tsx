import { isResizeKey } from '@saerskriven/canvas';
import type { Locale } from '@saerskriven/i18n';
import { useStoreApi } from '@xyflow/react';
import {
  useImperativeHandle,
  useRef,
  type KeyboardEvent,
  type Ref,
} from 'react';
import type { StudioTranslator } from '../messages/catalogues.js';
import { useTranslator } from '../messages/locale.js';
import type { State } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { keyboardMoved } from './keyboard-moves.js';
import { currentLayout, selectionPosition } from './layout.js';

/** Hands on a keydown that has already passed React Flow's own key handlers. */
export type KeyboardMoveReport = (event: KeyboardEvent) => void;

/** The frame React Flow draws around a box selection, which takes focus and the arrow keys that move the group. */
export const selectionFrameSelector = '.react-flow__nodesselection-rect';

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
 * The text that makes the live region speak `message` even where it repeats
 * `said`, the text last written there: a repeat gains a trailing no-break
 * space, and the repeat after that loses it again.
 */
export function freshLiveText(said: string, message: string): string {
  return message === said ? `${message}\u00a0` : message;
}

/**
 * React Flow's own move message, left blank: React Flow writes it from the
 * position before the move, truncated, and `KeyboardMoveMessage` writes the
 * message once the move has landed.
 */
export const preMoveMessage = (): string => '';

/**
 * Writes React Flow's live region after an arrow key within a node, or on the
 * rectangle React Flow draws around a box selection, has moved the
 * selection, and tells the view's follower through `keyboardMoved`. The
 * canvas wrapper hands `ref` each keydown once React Flow's handler has run,
 * so the store already holds the move. Mounted inside `ReactFlow`, where its
 * store is in reach.
 */
export function KeyboardMoveMessage({
  ref,
}: {
  readonly ref: Ref<KeyboardMoveReport>;
}): null {
  const flow = useStoreApi();
  const translator = useTranslator();
  const said = useRef('');
  useImperativeHandle(
    ref,
    () => (event: KeyboardEvent) => {
      if (!event.defaultPrevented || !movedBySelectionKey(event)) {
        return;
      }
      keyboardMoved();
      const message = movedSelectionMessage(modelStore.getState(), translator);
      if (message !== undefined) {
        said.current = freshLiveText(said.current, message);
        flow.setState({ ariaLiveMessage: said.current });
      }
    },
    [flow, translator],
  );
  return null;
}

function movedBySelectionKey(event: KeyboardEvent): boolean {
  return (
    isResizeKey(event.key) &&
    event.target instanceof Element &&
    event.target.closest(`.react-flow__node, ${selectionFrameSelector}`) !==
      null
  );
}
