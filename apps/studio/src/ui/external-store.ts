import { useSyncExternalStore } from 'react';

type ExternalStore<Snapshot> = {
  readonly notify: () => void;
  readonly use: () => Snapshot;
};

/**
 * Subscribers to a value its module holds and reads with `read`, which the
 * module calls `notify` on after the value moves and components read through
 * `use`. `readOnServer` is the server snapshot, `read` unless given.
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
