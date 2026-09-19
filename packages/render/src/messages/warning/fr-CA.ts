import { catalogue } from '@saerskriven/i18n';
import { warningMessages } from './contract.js';

export const warningFrCA = catalogue(warningMessages)('fr-CA')({
  unplaced:
    'avertissement : une extrémité de flux désigne un élément que le canevas ne dessine pas comme une boîte, alors ce flux n’est pas dans le dessin.',
  'unplaced-source': 'la source du flux {flow} désigne {element}',
  'unplaced-target': 'la destination du flux {flow} désigne {element}',
});
