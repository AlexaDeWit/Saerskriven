import { text } from '@saerskriven/i18n';

/** The burger menu, its submenus, and the diagram switcher. */
export const menuMessages = {
  menu: text(),
  'menu-unsaved': text(),
  project: text(),
  'view-source': text(),
  cancel: text(),
  'discard-and-open': text(),
  'discard-and-import': text(),
  'discard-and-new': text(),
  'save-as-format': text({ format: 'text' }),
  'file-state-dirty': text({ name: 'text', format: 'text' }),
  'file-state-clean': text({ name: 'text', format: 'text' }),
  arrange: text(),
  export: text(),
  appearance: text(),
  'appearance-chosen': text({ mode: 'text' }),
  'snap-on': text(),
  'snap-off': text(),
  diagram: text(),
  'no-diagram': text(),
  'diagram-named': text({ title: 'text' }),
} as const;
