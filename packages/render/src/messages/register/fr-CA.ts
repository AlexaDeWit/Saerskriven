import { catalogue } from '@saerskriven/i18n';
import { registerMessages } from './contract.js';

export const registerFrCA = catalogue(registerMessages)('fr-CA')({
  untitled: 'Registre des menaces',
  titled: 'Registre des menaces : {title}',
  threat: 'Menace {number} : {title}',
  number: 'Numéro',
  title: 'Titre',
  elements: 'Éléments',
  category: 'Catégorie',
  severity: 'Gravité',
  status: 'État',
  flags: 'Signalements',
  description: 'Description',
  field: '{label} : {value}',
  none: 'Aucun',
  'none-recorded': 'Rien de consigné.',
  'no-threats': 'Ce modèle ne consigne aucune menace.',
});
