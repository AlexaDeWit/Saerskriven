/**
 * A mouse event that carries the `view` its init names. Under vitest, jsdom's
 * constructor refuses the spec's `window` as a `view`, so the view is set once
 * the event exists.
 */
export class ViewKeepingMouseEvent extends MouseEvent {
  constructor(type: string, { view, ...init }: MouseEventInit = {}) {
    super(type, init);
    Object.defineProperty(this, 'view', { value: view });
  }
}

const row = 100;

/**
 * A bubbling, cancelable mouse event at `clientX` on the row `clientY` 100,
 * with the window as its view.
 */
export const mouseEvent = (
  type: 'mousedown' | 'mousemove' | 'mouseup',
  clientX: number,
): MouseEvent =>
  new ViewKeepingMouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY: row,
    view: window,
  });

/** One finger of a touch event: its identifier and where it is on screen. */
export type Finger = Pick<Touch, 'identifier' | 'clientX' | 'clientY'>;

/** A finger at `clientX` on the row {@link mouseEvent} presses on. */
export const finger = (identifier: number, clientX: number): Finger => ({
  identifier,
  clientX,
  clientY: row,
});

/**
 * A bubbling, cancelable event of a touch type about the finger `changed`.
 * `touches` is every finger down once the event has happened, the one longest
 * down first: unless given, `changed` alone for a start or a move, and none
 * for a lift or a cancel. jsdom has no `Touch` to construct and a `TouchEvent`
 * is typed to take them, so each finger is a plain object and the lists are
 * set on a plain event.
 */
export const touchEvent = (
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  changed: Finger,
  touches: readonly Finger[] = type === 'touchstart' || type === 'touchmove'
    ? [changed]
    : [],
): Event => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    changedTouches: { value: [changed] },
    touches: { value: touches },
  });
  return event;
};
