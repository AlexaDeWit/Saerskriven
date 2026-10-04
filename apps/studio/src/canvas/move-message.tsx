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
import { selectionRectangleSelector } from './selection-frame.js';

/** Hands on a keydown that has already passed React Flow's own key handlers. */
export type KeyboardMoveReport = (event: KeyboardEvent) => void;

/** Uses the locale decimal sign without rounding or grouping, as Position and size does. */
export function coordinateText(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 20,
    useGrouping: false,
  }).format(value);
}

/** Reports the stored selection position, or nothing when no element is selected. */
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

/** Alternates a trailing no-break space so the live region speaks repeated messages. */
export function freshLiveText(said: string, message: string): string {
  return message === said ? `${message}\u00a0` : message;
}

/** Suppresses React Flow's move message, which uses the position before the move. */
export const preMoveMessage = (): string => '';

/** Reports after React Flow handles the keydown and the store holds the move. Requires a React Flow provider. */
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
    event.target.closest(`.react-flow__node, ${selectionRectangleSelector}`) !==
      null
  );
}
