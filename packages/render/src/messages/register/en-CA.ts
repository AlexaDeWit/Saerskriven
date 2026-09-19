import { catalogue } from '@saerskriven/i18n';
import { registerMessages } from './contract.js';

export const registerEnCA = catalogue(registerMessages)('en-CA')({
  untitled: 'Threat register',
  titled: '{title} threat register',
  threat: 'Threat {number}: {title}',
  number: 'Number',
  title: 'Title',
  elements: 'Elements',
  category: 'Category',
  severity: 'Severity',
  status: 'Status',
  flags: 'Flags',
  description: 'Description',
  field: '{label}: {value}',
  none: 'None',
  'none-recorded': 'None recorded.',
  'no-threats': 'This model records no threats.',
});
