import { catalogue } from '@saerskriven/i18n';
import { menuMessages } from './contract.js';

export const menuEnCA = catalogue(menuMessages)('en-CA')({
  menu: 'Menu',
  'menu-unsaved': 'Menu, unsaved changes',
  project: 'Project',
  'view-source': 'View source on GitHub',
  cancel: 'Cancel',
  'discard-and-open': 'Discard changes and open',
  'discard-and-import': 'Discard changes and import',
  'discard-and-new': 'Discard changes and create new model',
  'save-as-format': 'Save as {format}',
  'file-state-dirty': '{name}, {format}, unsaved changes',
  'file-state-clean': '{name}, {format}, no unsaved changes',
  arrange: 'Arrange',
  export: 'Export',
  appearance: 'Appearance',
  'appearance-chosen': 'Appearance {mode}',
  'snap-on': 'Snap to grid: on',
  'snap-off': 'Snap to grid: off',
  diagram: 'Diagram',
  'no-diagram': 'No diagram',
  'diagram-named': 'Diagram: {title}',
});
