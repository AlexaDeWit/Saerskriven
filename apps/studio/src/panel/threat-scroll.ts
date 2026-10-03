import {
  useEffect,
  useLayoutEffect,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
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
 * A focused field and the room around it in a scrolling body, as viewport
 * coordinates: `top` is where the open threat's pinned summary ends, `bottom`
 * where the body's viewport does, and `next` the bottom of the field Tab
 * reaches next, where there is one.
 */
export type FieldPlace = {
  readonly scrolled: number;
  readonly top: number;
  readonly bottom: number;
  readonly fieldTop: number;
  readonly fieldBottom: number;
  readonly next: number | undefined;
};

/**
 * The scroll position that shows a focused field below the pinned summary
 * with the next field in view under it, moved as little as it takes. Where
 * both do not fit, the field's top stays just below the summary.
 */
export const fieldScroll = ({
  scrolled,
  top,
  bottom,
  fieldTop,
  fieldBottom,
  next,
}: FieldPlace): number => {
  if (fieldTop < top) {
    return scrolled - (top - fieldTop);
  }
  const wanted = Math.max(fieldBottom, next ?? fieldBottom);
  return wanted <= bottom
    ? scrolled
    : scrolled + Math.min(wanted - bottom, fieldTop - top);
};

const focusable =
  'input, textarea, button, select, [role="combobox"], [tabindex]:not([tabindex="-1"])';

type ScrollingBody = {
  readonly body: HTMLElement;
  readonly top: number;
};

function scrollingBody(
  list: RefObject<HTMLElement | null>,
): ScrollingBody | undefined {
  const body = list.current?.closest<HTMLElement>(`.${styles.body}`);
  return body === null || body === undefined
    ? undefined
    : { body, top: body.getBoundingClientRect().top + body.clientTop };
}

function itemOf(
  list: RefObject<HTMLElement | null>,
  threatId: string,
): HTMLElement | undefined {
  return [
    ...(list.current?.querySelectorAll<HTMLElement>('[data-threat-item]') ??
      []),
  ].find((item) => item.dataset['threatItem'] === threatId);
}

function labelsOf(field: HTMLElement): readonly HTMLLabelElement[] {
  return field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement ||
    field instanceof HTMLButtonElement
    ? [...(field.labels ?? [])]
    : [];
}

function labelTop(field: HTMLElement): number {
  return Math.min(
    field.getBoundingClientRect().top,
    ...labelsOf(field).map((label) => label.getBoundingClientRect().top),
  );
}

function nextField(
  body: HTMLElement,
  field: HTMLElement,
): HTMLElement | undefined {
  return [...body.querySelectorAll<HTMLElement>(focusable)].find(
    (candidate) =>
      (field.compareDocumentPosition(candidate) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
        0 &&
      !field.contains(candidate) &&
      candidate.getClientRects().length > 0,
  );
}

/** The calls the threat list makes to place an opened threat and a focused field. */
export type ThreatScroll = {
  readonly land: (threatId: string) => void;
  readonly keep: (threatId: string) => void;
  readonly follow: (event: FocusEvent<HTMLElement>) => void;
  readonly tab: (event: KeyboardEvent<HTMLElement>) => void;
};

function openHeader(
  list: RefObject<HTMLElement | null>,
): HTMLElement | undefined {
  return (
    list.current?.querySelector<HTMLElement>(
      `[data-threat-item][data-state='open'] > .${styles.header}`,
    ) ?? undefined
  );
}

/**
 * Places threats in the body that scrolls the list. `land` brings an opened
 * threat's header to the top of the body and `keep` holds a closing one's
 * header where it was, each in the next animation frame, because Radix
 * removes collapsed content in a layout effect of its own. `follow`, for the
 * list's focus events, keeps a field Tab reached clear of the open threat's
 * pinned summary, with room for the next field below it, and `tab`, for its
 * key presses, marks the Tab it follows. The body's scroll padding is kept
 * to the pinned summary's height, so the browser's own scrolling stops
 * below it too.
 */
export function useThreatScroll(
  list: RefObject<HTMLElement | null>,
): ThreatScroll {
  const frame = useRef<number | undefined>(undefined);
  const tabbed = useRef(false);

  useLayoutEffect(() => {
    const body = scrollingBody(list)?.body;
    if (body !== undefined) {
      const header = openHeader(list);
      body.style.scrollPaddingBlockStart =
        header === undefined ? '' : `${String(header.offsetHeight)}px`;
    }
  });

  useEffect(
    () => () => {
      if (frame.current !== undefined) {
        cancelAnimationFrame(frame.current);
      }
    },
    [],
  );

  const later = (place: () => void): void => {
    if (frame.current !== undefined) {
      cancelAnimationFrame(frame.current);
    }
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      place();
    });
  };

  return {
    land: (threatId) => {
      later(() => {
        const item = itemOf(list, threatId);
        const scrolling = scrollingBody(list);
        if (item === undefined || scrolling === undefined) {
          return;
        }
        scrolling.body.scrollTop +=
          item.getBoundingClientRect().top - scrolling.top;
      });
    },
    keep: (threatId) => {
      const header = itemOf(list, threatId)?.querySelector<HTMLElement>(
        `.${styles.header}`,
      );
      const scrolling = scrollingBody(list);
      if (header === null || header === undefined || scrolling === undefined) {
        return;
      }
      const was = header.getBoundingClientRect().top - scrolling.top;
      later(() => {
        if (!header.isConnected) {
          return;
        }
        const { body, top } = scrolling;
        const drawn = header.getBoundingClientRect();
        body.scrollTop = keptScroll({
          offset: drawn.top - top + body.scrollTop,
          height: drawn.height,
          was,
          viewport: body.clientHeight,
        });
      });
    },
    follow: (event) => {
      const field = event.target;
      if (!tabbed.current) {
        return;
      }
      tabbed.current = false;
      const item = field.closest<HTMLElement>('[data-threat-item]');
      const header = item?.querySelector<HTMLElement>(`.${styles.header}`);
      const scrolling = scrollingBody(list);
      if (
        item?.dataset['state'] !== 'open' ||
        header === null ||
        header === undefined ||
        header.contains(field) ||
        scrolling === undefined
      ) {
        return;
      }
      const { body, top } = scrolling;
      body.scrollTop = fieldScroll({
        scrolled: body.scrollTop,
        top: top + header.offsetHeight,
        bottom: top + body.clientHeight,
        fieldTop: labelTop(field),
        fieldBottom: field.getBoundingClientRect().bottom,
        next: nextField(body, field)?.getBoundingClientRect().bottom,
      });
    },
    tab: (event) => {
      tabbed.current = event.key === 'Tab';
    },
  };
}
