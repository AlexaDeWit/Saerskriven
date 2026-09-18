import { useEffect } from 'react';
import { localPreferenceStorage } from './preference-storage.js';
import {
  readColourMode,
  writeColourMode,
  type ColourMode,
} from './theme-preference.js';
import { externalStore } from './ui/external-store.js';

let selectedMode: ColourMode | undefined;

const currentMode = (): ColourMode =>
  (selectedMode ??= readColourMode(localPreferenceStorage()));

const applyColourMode = (mode: ColourMode): void => {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  if (mode === 'system') {
    delete root.dataset.pnColourMode;
  } else {
    root.dataset.pnColourMode = mode;
  }
};

const colourMode = externalStore(currentMode, (): ColourMode => 'system');

applyColourMode(currentMode());

/** Applies the selected colour mode to the document root. */
export function Theme() {
  const [mode] = useColourMode();

  useEffect(() => {
    applyColourMode(mode);
  }, [mode]);

  return null;
}

/** The chosen colour mode, and the function that chooses and stores another. */
export function useColourMode(): readonly [
  ColourMode,
  (mode: ColourMode) => void,
] {
  const mode = colourMode.use();

  const choose = (next: ColourMode): void => {
    selectedMode = next;
    writeColourMode(localPreferenceStorage(), next);
    colourMode.notify();
  };

  return [mode, choose];
}
