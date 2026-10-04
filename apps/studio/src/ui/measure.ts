import { useEffectEvent, useLayoutEffect, type RefObject } from 'react';

type MeasureOptions = {
  readonly alsoParent?: boolean;
  readonly observeContent?: boolean;
};

/**
 * `alsoParent` requires and observes the parent. `observeContent` also reads
 * text changes that leave the box size unchanged. Calls reach the latest
 * callbacks without restarting for callback identity changes.
 */
export function useMeasured<T extends Element>(
  target: RefObject<T | null>,
  read: (node: T, parent: Element | null) => void,
  clear: () => void,
  { alsoParent = false, observeContent = false }: MeasureOptions = {},
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
    const contentObserver = observeContent
      ? new MutationObserver(measure)
      : null;
    contentObserver?.observe(node, {
      characterData: true,
      childList: true,
      subtree: true,
    });
    return () => {
      observer.disconnect();
      contentObserver?.disconnect();
      onClear();
    };
  }, [alsoParent, observeContent, target]);
}
