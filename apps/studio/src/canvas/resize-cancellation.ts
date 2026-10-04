import { useState, type RefObject } from 'react';

/** Subscribes controls to cancellation before a blurred resize's window mouse release. */
export function useResizeCancellation(
  surface: RefObject<HTMLDivElement | null>,
) {
  const [cancellation] = useState(() => {
    const listeners = new Set<() => void>();
    return {
      subscribe: (cancel: () => void): (() => void) => {
        listeners.add(cancel);
        return () => {
          listeners.delete(cancel);
        };
      },
      cancel: (): void => {
        for (const listener of listeners) {
          listener();
        }
      },
    };
  });
  return {
    subscribe: cancellation.subscribe,
    cancel: cancellation.cancel,
    startsGesture: ({ button, target }: MouseEvent): boolean =>
      button === 0 &&
      target instanceof Element &&
      surface.current?.contains(target) === true &&
      target.closest('.react-flow__resize-control') !== null,
  };
}
