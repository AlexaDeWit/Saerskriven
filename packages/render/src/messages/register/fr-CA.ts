import { catalogue } from '@saerskriven/i18n';
import { registerMessages } from './contract.js';

export const registerFrCA = catalogue(registerMessages)('fr-CA')({
  untitled: 'Registre des menaces',
  titled: 'Registre des menaces : {title}',
  threat: 'Menace {number} : {title}',
  number: 'Numéro',
  title: 'Titre',
  elements: 'Éléments',
  'whole-model': 'Le modèle entier',
  category: 'Catégorie',
  severity: 'Gravité',
  status: 'État',
  flags: 'Signalements',
  description: 'Description',
  field: '{label} : {value}',
  none: 'Aucun',
  'none-recorded': 'Rien de consigné.',
  'no-threats': 'Ce modèle ne consigne aucune menace.',
  'flow-from-to': 'Flux depuis {source} vers {target}',
  'flow-between': 'Flux entre {source} et {target}',
  'free-point': 'un point libre',
  diagrams: 'Diagrammes',
  'diagram-empty': 'Ce diagramme ne contient aucun élément.',
  'diagram-free-endpoint': 'Extrémité libre',
  'diagram-note': 'Note',
  'diagram-reference': 'Référence : {label}',
  'diagram-out-of-scope': '{label} (hors périmètre)',
  'diagram-omitted-boundaries':
    'Frontières de confiance non représentées : {names}.',
  'diagram-substituted-references':
    'Les connexions à ces éléments utilisent des références de remplacement : {names}.',
});
