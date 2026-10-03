/**
 * A mouse event that carries the `view` its init names. jsdom's constructor
 * refuses the window a vitest spec runs in as a `view`, so the view is set
 * once the event exists.
 */
export class ViewKeepingMouseEvent extends MouseEvent {
  constructor(type: string, { view, ...init }: MouseEventInit = {}) {
    super(type, init);
    Object.defineProperty(this, 'view', { value: view });
  }
}

/** One finger of a touch event: its identifier and where it is on screen. */
export type Finger = {
  readonly identifier: number;
  readonly clientX: number;
  readonly clientY: number;
};

/**
 * A touch event about the finger `changed`, with `touches` every finger still
 * down, the one longest down first: `changed` alone unless given, and none for
 * the lift of the only finger. jsdom has no `Touch`, and its `TouchEvent`
 * comes back with both lists empty, so they are set on a plain event.
 */
export const touchEvent = (
  type: 'touchstart' | 'touchmove' | 'touchend',
  changed: Finger,
  touches: readonly Finger[] = [changed],
): Event => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    changedTouches: { value: [changed] },
    touches: { value: touches },
  });
  return event;
};
