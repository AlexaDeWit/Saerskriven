import { catalogue } from '@saerskriven/i18n';
import { panelMessages } from './contract.js';

export const panelEnCA = catalogue(panelMessages)('en-CA')({
  threats: 'Threats',
  'threats-on': 'Threats on {element}',
  'close-threats': 'Close threats',
  'widen-pane': 'Widen pane',
  'restore-pane-width': 'Restore pane width',
  'several-selected': {
    one: '{count} element selected. Select one of them to record a threat against it.',
    other:
      '{count} elements selected. Select one of them to record a threat against it.',
  },
  'add-threat': 'Add a threat',
  'no-threats': 'No threats are recorded against this element.',
  'delete-threat': 'Delete threat {number}',
  'threat-spread': {
    one: 'This threat names {count} element. Deleting it takes it off all of them.',
    other:
      'This threat names {count} elements. Deleting it takes it off all of them.',
  },
  'attached-elements': 'Attached elements',
  'summary-severity': 'Severity: {severity}',
  'summary-status': 'Status: {status}',
  'summary-mitigations': 'Mitigations: {count}',
  'summary-assumptions': 'Assumptions: {count}',
  'security-properties': 'Security properties',
  'not-recorded-hint': 'Not recorded means no security assertion is stored.',
  'no-relationships': 'No relationships.',
  'no-valid-targets': 'No valid targets in this diagram.',
  'add-relationship': 'Add relationship',
  remove: 'Remove',
  add: 'Add',
  link: 'Link',
  discard: 'Discard',
  unlink: 'Unlink',
  attach: 'Attach',
  detach: 'Detach',
  'also-applies-to-model': 'Also applies to the model.',
  'also-on-threats': {
    one: 'Also on threat {list}.',
    other: 'Also on threats {list}.',
  },
  'more-threats': '{count} more',
  'detail-threats': {
    one: 'threat {list}',
    other: 'threats {list}',
  },
  'detail-applies-to-model': 'applies to the model',
  'detail-no-elements': 'attached to no element',
});
