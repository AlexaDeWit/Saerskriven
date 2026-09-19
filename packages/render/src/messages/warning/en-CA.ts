import { catalogue } from '@saerskriven/i18n';
import { warningMessages } from './contract.js';

export const warningEnCA = catalogue(warningMessages)('en-CA')({
  unplaced:
    'warning: a flow endpoint names an element the canvas draws as no box, so its flow is not in the drawing.',
  'unplaced-source': 'flow {flow} source names {element}',
  'unplaced-target': 'flow {flow} target names {element}',
});
