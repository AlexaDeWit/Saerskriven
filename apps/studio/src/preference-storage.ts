/** The part of `Storage` a stored preference reads and writes. */
export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * The browser's local storage, or nothing where reading it throws, which is
 * what a browser does when site data is blocked.
 */
export function localPreferenceStorage(): PreferenceStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The value stored under `key`, read through `parse`. Storage that is absent
 * or throws is handed `null`, so `parse` decides one value for a missing, an
 * unreadable and an unknown entry.
 */
export function readPreference<Value>(
  storage: PreferenceStorage | undefined,
  key: string,
  parse: (stored: string | null) => Value,
): Value {
  try {
    return parse(storage?.getItem(key) ?? null);
  } catch {
    return parse(null);
  }
}

/** Stores `value` under `key`, ignoring storage that is absent or throws. */
export function writePreference(
  storage: PreferenceStorage | undefined,
  key: string,
  value: string,
): void {
  try {
    storage?.setItem(key, value);
  } catch {
    return;
  }
}
