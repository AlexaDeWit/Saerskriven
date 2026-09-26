import { catalogue } from '@saerskriven/i18n';
import { panelMessages } from './contract.js';

export const panelFrCA = catalogue(panelMessages)('fr-CA')({
  threats: 'Menaces',
  'threats-on': 'Menaces sur {element}',
  'close-threats': 'Fermer les menaces',
  'widen-pane': 'Élargir le volet',
  'restore-pane-width': 'Rétablir la largeur du volet',
  'several-selected': {
    one: '{count} élément sélectionné. Sélectionnez-en un seul pour y consigner une menace.',
    many: '{count} d’éléments sélectionnés. Sélectionnez-en un seul pour y consigner une menace.',
    other:
      '{count} éléments sélectionnés. Sélectionnez-en un seul pour y consigner une menace.',
  },
  'add-threat': 'Ajouter une menace',
  'no-threats': 'Aucune menace n’est consignée sur cet élément.',
  'delete-threat': 'Supprimer la menace {number}',
  'threat-spread': {
    one: 'Cette menace nomme {count} élément. La supprimer la retire de tous.',
    many: 'Cette menace nomme {count} d’éléments. La supprimer la retire de tous.',
    other:
      'Cette menace nomme {count} éléments. La supprimer la retire de tous.',
  },
  'attached-elements': 'Éléments rattachés',
  'summary-severity': 'Gravité : {severity}',
  'summary-status': 'État : {status}',
  'summary-mitigations': 'Mesures : {count}',
  'summary-assumptions': 'Hypothèses : {count}',
  'security-properties': 'Propriétés de sécurité',
  'not-recorded-hint':
    'Non consigné signifie qu’aucune affirmation de sécurité n’est enregistrée.',
  'no-relationships': 'Aucune relation.',
  'no-valid-targets': 'Aucune cible valide dans ce diagramme.',
  'add-relationship': 'Ajouter une relation',
  remove: 'Retirer',
  add: 'Ajouter',
  link: 'Lier',
  discard: 'Abandonner',
  unlink: 'Délier',
  attach: 'Rattacher',
  detach: 'Détacher',
  'also-applies-to-model': 'S’applique aussi au modèle.',
  'also-on-threats': {
    one: 'Aussi sur la menace {list}.',
    many: 'Aussi sur les menaces {list}.',
    other: 'Aussi sur les menaces {list}.',
  },
  'more-threats': '{count} de plus',
  'detail-threats': {
    one: 'menace {list}',
    many: 'menaces {list}',
    other: 'menaces {list}',
  },
  'detail-applies-to-model': 's’applique au modèle',
  'detail-no-elements': 'rattachée à aucun élément',
});
