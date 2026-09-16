import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { holdHandTool, releaseHandTool } from '../canvas/tools.js';
import {
  commandFor,
  runCommand,
  type Command,
  type CommandSurface,
} from './registry.js';
import { modelStore } from '../store/store.js';
import { hostPlatform, type Platform } from './shortcuts.js';

const nothing = (): void => undefined;

/** Commands without a mounted surface do nothing. Store commands remain available. */
export const unmountedSurface: CommandSurface = {
  files: {
    open: nothing,
    import: nothing,
    save: nothing,
    saveAs: nothing,
    exportDiagram: nothing,
    exportRegister: nothing,
    exportTypst: nothing,
    exportPdf: nothing,
    exportPng: nothing,
    close: nothing,
  },
  reference: { toggle: nothing },
  view: {
    zoomIn: nothing,
    zoomOut: nothing,
    fitToView: nothing,
    fitSelection: nothing,
    resetZoom: nothing,
  },
};

type KeyboardOwner = 'page' | 'typing' | 'overlay';

const overlaySelector =
  '[role="combobox"][aria-expanded="true"], [role="listbox"], [role="menu"], [role="dialog"]';

const typingSelector =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"]';

const nativeActivationSelector = 'button, a[href]';

/** Whether Enter or Space should activate the focused native control. */
export function nativeActivationTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(nativeActivationSelector) !== null
  );
}

/**
 * Who holds the keyboard while `target` has focus. A listbox trigger counts
 * as an overlay only while `aria-expanded` says it is open, and as typing
 * while closed.
 */
export function keyboardOwner(target: EventTarget | null): KeyboardOwner {
  if (!(target instanceof Element)) {
    return 'page';
  }
  if (target.closest(overlaySelector) !== null) {
    return 'overlay';
  }
  return target.closest(typingSelector) === null ? 'page' : 'typing';
}

/** Selects a command while respecting handled events, overlays, and text-field ownership. */
export function commandForKey(
  event: KeyboardEvent,
  platform: Platform,
): Command | undefined {
  const owner = keyboardOwner(event.target);
  if (event.defaultPrevented || owner === 'overlay') {
    return undefined;
  }
  const command = commandFor(event, platform);
  if (
    command === undefined ||
    (owner === 'typing' && !command.inTextFields) ||
    command.available?.(modelStore.getState()) === false
  ) {
    return undefined;
  }
  return command;
}

/** Binds registered chords at page scope and suppresses matching browser shortcuts. */
export function useCommandKeys(surface: CommandSurface): void {
  useEffect(() => {
    const pressed = (event: KeyboardEvent): void => {
      if (event.key === ' ' && nativeActivationTarget(event.target)) {
        return;
      }
      const command = commandForKey(event, hostPlatform);
      if (command === undefined) {
        return;
      }
      event.preventDefault();
      if (command.id === 'hand-tool' && event.key === ' ') {
        holdHandTool();
      } else {
        runCommand(command, surface);
      }
    };
    const released = (event: KeyboardEvent): void => {
      if (event.key === ' ') {
        releaseHandTool();
      }
    };
    document.addEventListener('keydown', pressed);
    document.addEventListener('keyup', released);
    window.addEventListener('blur', releaseHandTool);
    return () => {
      document.removeEventListener('keydown', pressed);
      document.removeEventListener('keyup', released);
      window.removeEventListener('blur', releaseHandTool);
    };
  }, [surface]);
}

const surfaceContext = createContext<CommandSurface>(unmountedSurface);

type CommandSurfaceProviderProps = {
  readonly surface: CommandSurface;
  readonly children: ReactNode;
};

/** Shares one command surface between keyboard dispatch and controls. */
export function CommandSurfaceProvider({
  surface,
  children,
}: CommandSurfaceProviderProps) {
  useCommandKeys(surface);
  return (
    <surfaceContext.Provider value={surface}>
      {children}
    </surfaceContext.Provider>
  );
}

/** The surface a control runs its command against. */
export function useCommandSurface(): CommandSurface {
  return useContext(surfaceContext);
}
