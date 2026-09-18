import { catalogue } from '@saerskriven/i18n';
import { toolMessages } from './contract.js';

export const toolsFrCA = catalogue(toolMessages)('fr-CA')({
  'diagram-region': 'Diagramme',
  'free-point': 'un point libre',
  'flow-between': 'entre {source} et {target}',
  'flow-from-to': 'de {source} vers {target}',
  'open-threats': {
    one: '{count} menace ouverte',
    many: '{count} de menaces ouvertes',
    other: '{count} menaces ouvertes',
  },
  'severity-not-assessed': 'gravité non évaluée',
  'highest-severity': 'gravité la plus élevée {severity}',
  'zoom-and-fit': 'Zoom et ajustement',
  'current-zoom': 'Zoom actuel : {percent} %.',
  'flow-target': 'Destination du flux',
  'choose-flow-target': 'Choisir une destination de flux',
  'reconnect-flow': 'Reconnecter le flux',
  'flow-endpoint': 'Extrémité du flux',
  'select-node-geometry': 'Sélectionnez un nœud pour modifier sa géométrie.',
  'select-one-flow': 'Sélectionnez un seul flux pour le reconnecter.',
  close: 'Fermer',
  cancel: 'Annuler',
  'apply-geometry': 'Appliquer la géométrie',
  'apply-endpoint': 'Appliquer l’extrémité',
  'axis-x': 'X',
  'axis-y': 'Y',
  width: 'Largeur',
  height: 'Hauteur',
  decrease: 'Diminuer {label}',
  increase: 'Augmenter {label}',
  source: 'Source',
  target: 'Destination',
  side: 'Côté',
  automatic: 'Automatique',
  'flow-route': 'Tracé du flux',
  'bend-actions': 'Actions du coude',
  'flow-end-actions': 'Actions de l’extrémité du flux',
  'bend-numbered': 'Coude {number}',
  'flow-source-end': 'Extrémité source du flux',
  'flow-target-end': 'Extrémité destination du flux',
  'remove-bend': 'Retirer le coude',
  'move-bend': 'Déplacer le coude',
  'follow-route': 'Suivre le tracé',
  'bend-handle-help':
    'Faites glisser ou utilisez les touches fléchées pour déplacer. Cliquez pour les actions. Suppr retire ce coude.',
  'flow-end-handle-help':
    'Faites glisser vers un autre côté de son élément. Les touches fléchées fixent un côté, Suppr la laisse suivre le tracé. Cliquez pour les actions.',
  'bend-choose-help':
    'Segment {number} : Gauche/Droite pour choisir, Entrée pour ajouter. Ou cliquez un segment.',
  'bend-place-help':
    'Les touches fléchées déplacent le coude. Entrée confirme, Échap annule. Ou cliquez sa destination.',
  'bend-idle-help':
    'Tirez la ligne pour ajouter un coude. Faites glisser un coude pour le déplacer. Faites glisser une extrémité vers un autre côté de son élément. Cliquez une poignée pour les actions.',
});
