import { useEffectEvent, useLayoutEffect, type RefObject } from 'react';

type MeasureOptions = {
  readonly alsoParent?: boolean;
};

/**
 * Reads an element in a layout effect and on every resize, and calls `clear`
 * once it goes. `alsoParent` observes the parent too and reads nothing
 * without one. The effect does not restart when a callback changes identity,
 * and each call reaches the latest callback.
 */
export function useMeasured<T extends Element>(
  target: RefObject<T | null>,
  read: (node: T, parent: Element | null) => void,
  clear: () => void,
  { alsoParent = false }: MeasureOptions = {},
): void {
  const onRead = useEffectEvent(read);
  const onClear = useEffectEvent(clear);

  useLayoutEffect(() => {
    const node = target.current;
    const parent = node?.parentElement ?? null;
    if (node === null || (alsoParent && parent === null)) {
      return undefined;
    }
    const measure = (): void => {
      onRead(node, parent);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (alsoParent && parent !== null) {
      observer.observe(parent);
    }
    return () => {
      observer.disconnect();
      onClear();
    };
  }, [alsoParent, target]);
}
