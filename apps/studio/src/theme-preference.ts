export const colourModes = ['system', 'light', 'dark'] as const;

export type ColourMode = (typeof colourModes)[number];

function isColourMode(value: string): value is ColourMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export const colourModeStorageKey = 'saerskrivenColourMode';

/** The stored colour mode, or `system` for a missing or unknown value. */
export function parseColourMode(value: string | null): ColourMode {
  return value !== null && isColourMode(value) ? value : 'system';
}

type ColourModeStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The stored colour mode, or `system` where storage is absent or throws. */
export function readColourMode(
  storage: ColourModeStorage | undefined,
): ColourMode {
  try {
    return parseColourMode(storage?.getItem(colourModeStorageKey) ?? null);
  } catch {
    return 'system';
  }
}

/** Stores the colour mode, ignoring storage that is absent or throws. */
export function writeColourMode(
  storage: ColourModeStorage | undefined,
  mode: ColourMode,
): void {
  try {
    storage?.setItem(colourModeStorageKey, mode);
  } catch {
    return;
  }
}
