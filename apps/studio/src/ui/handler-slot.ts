/** One handler a mounted component lends to a module, and how to read it. */
export type HandlerSlot<Handler> = {
  readonly register: (handler: Handler) => () => void;
  readonly current: () => Handler | undefined;
};

/**
 * A module's slot for the one handler a mounted component lends it. The
 * latest registration holds the slot, and a removal empties it only while
 * its own handler still holds it, so a component unmounting after another
 * mounted leaves the newer handler in place.
 */
export function handlerSlot<Handler>(): HandlerSlot<Handler> {
  let held: Handler | undefined;
  return {
    register: (handler) => {
      held = handler;
      return () => {
        if (held === handler) {
          held = undefined;
        }
      };
    },
    current: () => held,
  };
}
