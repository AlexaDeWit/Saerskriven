import { catalogue } from '@saerskriven/i18n';
import { registerMessages } from './contract.js';

export const registerEnCA = catalogue(registerMessages)('en-CA')({
  untitled: 'Threat register',
  titled: '{title} threat register',
  threat: 'Threat {number}: {title}',
  number: 'Number',
  title: 'Title',
  elements: 'Elements',
  'whole-model': 'The whole model',
  category: 'Category',
  severity: 'Severity',
  status: 'Status',
  flags: 'Flags',
  description: 'Description',
  field: '{label}: {value}',
  none: 'None',
  'none-recorded': 'None recorded.',
  'no-threats': 'This model records no threats.',
  'flow-from-to': 'Flow from {source} to {target}',
  'flow-between': 'Flow between {source} and {target}',
  'free-point': 'a free point',
  diagrams: 'Diagrams',
  'diagram-empty': 'This diagram has no elements.',
  'diagram-free-endpoint': 'Free endpoint',
  'diagram-note': 'Note',
  'diagram-reference': 'Reference: {label}',
  'diagram-out-of-scope': '{label} (out of scope)',
  'diagram-omitted-boundaries': 'Trust boundaries not shown: {names}.',
  'diagram-substituted-references':
    'Connections to these elements use reference placeholders: {names}.',
});
