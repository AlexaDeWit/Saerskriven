import { useEffect, useRef, type RefObject } from 'react';
import styles from './threat-panel.module.css';

/** Where a header sits in a scrolling body, measured from the top of the body's viewport. */
export type HeaderPlace = {
  readonly offset: number;
  readonly height: number;
  readonly was: number;
  readonly viewport: number;
};

/**
 * The scroll position that puts a header `was` below the top of the body's
 * viewport, moved as little as it takes to show the header whole, and to
 * show its top where the header is taller than the viewport. `offset` is the
 * header's distance from the top of the scrolled content.
 */
export const keptScroll = ({
  offset,
  height,
  was,
  viewport,
}: HeaderPlace): number =>
  Math.min(offset, Math.max(offset - was, offset + height - viewport));

/**
 * Returns a call that keeps one threat's header in view across an accordion
 * swap, applied in the next animation frame because Radix removes collapsed
 * content in a layout effect of its own.
 */
export function useHeaderKept(
  list: RefObject<HTMLDivElement | null>,
): (threatId: string) => void {
  const frame = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (frame.current !== undefined) {
        cancelAnimationFrame(frame.current);
      }
    },
    [],
  );

  return (threatId) => {
    const body = list.current?.closest(`.${styles.body}`);
    const header = [
      ...(list.current?.querySelectorAll<HTMLElement>('[data-threat-item]') ??
        []),
    ]
      .find((item) => item.dataset['threatItem'] === threatId)
      ?.querySelector(`.${styles.header}`);
    if (
      body === null ||
      body === undefined ||
      header === null ||
      header === undefined
    ) {
      return;
    }
    const top = (): number => body.getBoundingClientRect().top + body.clientTop;
    const was = header.getBoundingClientRect().top - top();
    if (frame.current !== undefined) {
      cancelAnimationFrame(frame.current);
    }
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      if (!header.isConnected) {
        return;
      }
      const drawn = header.getBoundingClientRect();
      body.scrollTop = keptScroll({
        offset: drawn.top - top() + body.scrollTop,
        height: drawn.height,
        was,
        viewport: body.clientHeight,
      });
    });
  };
}
