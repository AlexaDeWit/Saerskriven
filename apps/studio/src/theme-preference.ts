import {
  readPreference,
  writePreference,
  type PreferenceStorage,
} from './preference-storage.js';

export const colourModes = ['system', 'light', 'dark'] as const;

export type ColourMode = (typeof colourModes)[number];

export const colourModeStorageKey = 'saerskrivenColourMode';

const isColourMode = (value: string): value is ColourMode =>
  colourModes.some((mode) => mode === value);

/** The stored colour mode, or `system` for a missing or unknown value. */
export function parseColourMode(value: string | null): ColourMode {
  return value !== null && isColourMode(value) ? value : 'system';
}

/** The stored colour mode, or `system` where storage is absent or throws. */
export function readColourMode(
  storage: PreferenceStorage | undefined,
): ColourMode {
  return readPreference(storage, colourModeStorageKey, parseColourMode);
}

/** Stores the colour mode, ignoring storage that is absent or throws. */
export function writeColourMode(
  storage: PreferenceStorage | undefined,
  mode: ColourMode,
): void {
  writePreference(storage, colourModeStorageKey, mode);
}
