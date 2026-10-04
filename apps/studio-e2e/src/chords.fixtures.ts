import type { Page } from '@playwright/test';

/** The command modifier the studio detects from the page, independent of Playwright's host. */
export const commandKey = (page: Page): Promise<'Meta' | 'Control'> =>
  page.evaluate(() => {
    const hints = navigator as Navigator & {
      readonly userAgentData?: { readonly platform?: string };
    };
    const platform = hints.userAgentData?.platform ?? navigator.platform;
    return /mac|iphone|ipad|ipod/iu.test(`${platform} ${navigator.userAgent}`)
      ? 'Meta'
      : 'Control';
  });

/** Resolves the command modifier against the page rather than the driver's operating system. */
export const commandChord = async (
  page: Page,
  chord: string,
): Promise<string> => chord.replace('ControlOrMeta', await commandKey(page));

/** Studio chords with a page-resolved command modifier. Pass them through {@link commandChord} before pressing. */
export const registeredChords = {
  copy: ['ControlOrMeta+c'],
  cut: ['ControlOrMeta+x'],
  paste: ['ControlOrMeta+v'],
  duplicate: ['ControlOrMeta+d'],
  'edit-geometry': ['Shift+p'],
  'reconnect-source': ['Shift+s'],
  'reconnect-target': ['Shift+t'],
  'toggle-flow-direction': ['Shift+d'],
  'reverse-flow': ['Shift+r'],
  'toggle-boundary-shape': ['Shift+b'],
  'align-left': ['ControlOrMeta+Shift+ArrowLeft'],
  'align-centre': ['ControlOrMeta+Shift+h'],
  'align-right': ['ControlOrMeta+Shift+ArrowRight'],
  'align-top': ['ControlOrMeta+Shift+ArrowUp'],
  'align-middle': ['ControlOrMeta+Shift+v'],
  'align-bottom': ['ControlOrMeta+Shift+ArrowDown'],
  'distribute-horizontal': ['ControlOrMeta+Shift+d'],
  'distribute-vertical': ['ControlOrMeta+Shift+b'],
  'snap-to-grid': ['ControlOrMeta+Shift+g'],
  'threat-register': ['r'],
  'reset-zoom': ['ControlOrMeta+1'],
  'fit-selection': ['Shift+f'],
  'next-diagram': ['PageDown'],
  'previous-diagram': ['PageUp'],
  'new-diagram': [],
  'rename-diagram': [],

  open: ['ControlOrMeta+o'],
  save: ['ControlOrMeta+s'],
  'save-as': ['ControlOrMeta+Shift+s'],
  'export-diagram': [],
  'export-register': [],
  'export-markdown-complete': [],
  'export-typst': [],
  'export-pdf': [],
  'export-png': [],
  share: [],
  'close-file': ['ControlOrMeta+Shift+x'],
  undo: ['ControlOrMeta+z'],
  redo: ['ControlOrMeta+Shift+z', 'Control+y'],
  delete: ['Delete', 'Backspace'],
  rename: ['F2'],
  'model-panel': ['m'],
  'focus-threats': ['t'],
  'select-all': ['ControlOrMeta+a'],
  'fit-to-view': ['ControlOrMeta+0'],
  'zoom-in': ['ControlOrMeta+=', 'ControlOrMeta++'],
  'zoom-out': ['ControlOrMeta+-'],
  'start-flow': ['f'],
  'add-bend': ['+'],
  'select-tool': ['v', 'Escape', '1'],
  'hand-tool': ['h', 'Space'],
  'actor-tool': ['a', '2'],
  'process-tool': ['p', '3'],
  'store-tool': ['s', '4'],
  'boundary-box-tool': ['b', '5'],
  'boundary-curve-tool': ['c', '6'],
  'note-tool': ['n', '7'],
  'shortcut-reference': ['?', 'F1'],
} as const;
