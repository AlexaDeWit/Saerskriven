import { useSyncExternalStore } from 'react';

/** A module-level value components read through `useSyncExternalStore`. */
export type ExternalStore<Snapshot> = {
  readonly notify: () => void;
  readonly use: () => Snapshot;
};

/**
 * Subscribers for a value its module holds and reads with `read`. The module
 * calls `notify` after the value moves. `readOnServer` is the snapshot for a
 * server render, `read` itself unless given.
 */
export function externalStore<Snapshot>(
  read: () => Snapshot,
  readOnServer: () => Snapshot = read,
): ExternalStore<Snapshot> {
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  return {
    notify: () => {
      for (const listener of listeners) {
        listener();
      }
    },
    use: () => useSyncExternalStore(subscribe, read, readOnServer),
  };
}
