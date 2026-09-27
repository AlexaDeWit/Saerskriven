import { catalogue } from '@saerskriven/i18n';
import { canvasMessages } from './contract.js';

export const canvasFrCA = catalogue(canvasMessages)('fr-CA')({
  quoted: '« {text} »',
  'snap-on': 'Alignement sur la grille activé.',
  'snap-off': 'Alignement sur la grille désactivé.',
  'diagram-shown': 'Affichage de « {title} ».',
  'diagram-added': '« {title} » ajouté.',
  'diagram-renamed': 'Diagramme renommé en « {title} ».',
  'selection-cleared': 'Sélection effacée.',
  'geometry-updated': 'Position et taille mises à jour.',
  'geometry-invalid':
    'Saisissez des coordonnées finies et des dimensions positives.',
  arranged: {
    one: '{count} nœud disposé. Les coudes des flux et les extrémités libres restent en place.',
    many: '{count} de nœuds disposés. Les coudes des flux et les extrémités libres restent en place.',
    other:
      '{count} nœuds disposés. Les coudes des flux et les extrémités libres restent en place.',
  },
  'source-changed': 'Source du flux modifiée.',
  'target-changed': 'Destination du flux modifiée.',
  'flow-both-ways': 'Sens modifié : {flow} circule dans les deux sens.',
  'flow-one-way': 'Sens modifié : {flow} circule dans un seul sens.',
  'removed-named': 'Supprimé : {name}.',
  'removed-elements': {
    one: '{count} élément supprimé.',
    many: '{count} d’éléments supprimés.',
    other: '{count} éléments supprimés.',
  },
  'flows-detached': {
    one: '{count} flux détaché.',
    many: '{count} de flux détachés.',
    other: '{count} flux détachés.',
  },
  'threat-links-dropped': {
    one: '{count} lien de menace retiré.',
    many: '{count} de liens de menace retirés.',
    other: '{count} liens de menace retirés.',
  },
  'threats-removed': {
    one: '{count} menace supprimée.',
    many: '{count} de menaces supprimées.',
    other: '{count} menaces supprimées.',
  },
  'bend-added': 'Coude {number} ajouté sur {flow}.',
  'bend-moved': 'Coude {number} déplacé sur {flow}.',
  'bend-removed': 'Coude {number} retiré : {flow}.',
  'bend-at': 'Coude en x {x}, y {y}.',
  'source-released': 'Source libérée pour suivre le tracé : {flow}.',
  'target-released': 'Destination libérée pour suivre le tracé : {flow}.',
  'source-pinned': 'Source fixée : {flow}. Côté : {side}.',
  'target-pinned': 'Destination fixée : {flow}. Côté : {side}.',
  'undo-done': 'Annulation effectuée.',
  'redo-done': 'Rétablissement effectué.',
  'threat-deleted': 'Menace {number} supprimée.',
  'threat-attached-to-actor': 'Menace {number} rattachée à l’acteur.',
  'threat-attached-to-actor-named':
    'Menace {number} rattachée à l’acteur « {name} ».',
  'threat-attached-to-process': 'Menace {number} rattachée au processus.',
  'threat-attached-to-process-named':
    'Menace {number} rattachée au processus « {name} ».',
  'threat-attached-to-store':
    'Menace {number} rattachée au magasin de données.',
  'threat-attached-to-store-named':
    'Menace {number} rattachée au magasin de données « {name} ».',
  'threat-attached-to-text': 'Menace {number} rattachée au texte.',
  'threat-attached-to-text-named':
    'Menace {number} rattachée au texte « {name} ».',
  'threat-attached-to-flow': 'Menace {number} rattachée au flux.',
  'threat-attached-to-flow-named':
    'Menace {number} rattachée au flux « {name} ».',
  'threat-attached-to-trust-boundary':
    'Menace {number} rattachée à la frontière de confiance.',
  'threat-attached-to-trust-boundary-named':
    'Menace {number} rattachée à la frontière de confiance « {name} ».',
  'threat-detached-from-actor':
    'Menace {number} détachée de l’acteur. Elle reste sur ses autres éléments.',
  'threat-detached-from-actor-named':
    'Menace {number} détachée de l’acteur « {name} ». Elle reste sur ses autres éléments.',
  'threat-detached-from-process':
    'Menace {number} détachée du processus. Elle reste sur ses autres éléments.',
  'threat-detached-from-process-named':
    'Menace {number} détachée du processus « {name} ». Elle reste sur ses autres éléments.',
  'threat-detached-from-store':
    'Menace {number} détachée du magasin de données. Elle reste sur ses autres éléments.',
  'threat-detached-from-store-named':
    'Menace {number} détachée du magasin de données « {name} ». Elle reste sur ses autres éléments.',
  'threat-detached-from-text':
    'Menace {number} détachée du texte. Elle reste sur ses autres éléments.',
  'threat-detached-from-text-named':
    'Menace {number} détachée du texte « {name} ». Elle reste sur ses autres éléments.',
  'threat-detached-from-flow':
    'Menace {number} détachée du flux. Elle reste sur ses autres éléments.',
  'threat-detached-from-flow-named':
    'Menace {number} détachée du flux « {name} ». Elle reste sur ses autres éléments.',
  'threat-detached-from-trust-boundary':
    'Menace {number} détachée de la frontière de confiance. Elle reste sur ses autres éléments.',
  'threat-detached-from-trust-boundary-named':
    'Menace {number} détachée de la frontière de confiance « {name} ». Elle reste sur ses autres éléments.',
  'threat-detach-removed':
    'Menace {number} supprimée. Elle n’était rattachée à rien d’autre. Annuler la rétablit.',
  'record-named': '{kind} « {label} »',
  'record-unlinked':
    'Déliée : {record}. Elle reste liée à ses autres références.',
  'record-removed':
    'Supprimée : {record}. Rien d’autre ne l’utilisait. Annuler la rétablit.',
  'copy-nothing-selected': 'Sélectionnez des éléments à copier.',
  'copy-refused': 'La sélection n’a pas pu être copiée.',
  'copy-too-large':
    'La sélection dépasse la taille maximale du presse-papiers.',
  'clipboard-write-failed':
    'L’écriture dans le presse-papiers a échoué. Rien n’a été coupé. Vérifiez l’autorisation du presse-papiers dans le navigateur.',
  'clipboard-read-failed':
    'La lecture du presse-papiers a échoué. Vérifiez l’autorisation du presse-papiers dans le navigateur.',
  'paste-document-changed':
    'Le document a changé pendant la lecture du presse-papiers. Collez de nouveau.',
  'paste-no-selection':
    'Le presse-papiers ne contient aucune sélection Saerskriven.',
  'paste-invalid':
    'La sélection du presse-papiers est invalide, non prise en charge ou au-delà d’une limite de lecture.',
  'paste-no-diagram': 'Aucun diagramme dans lequel coller.',
  'paste-remap-failed':
    'Les identifiants du graphe copié n’ont pas pu être réattribués.',
  copied: 'Sélection copiée.',
  cut: 'Sélection coupée.',
  duplicated: 'Sélection dupliquée.',
  pasted:
    'Sélection collée avec de nouveaux identifiants d’éléments et de menaces.',
  'copy-counts':
    'Éléments : {elements}. Menaces : {threats}. Liens externes exclus : {excluded}.',
  'copy-source-fields':
    'Les champs du format source hors du modèle ne sont pas copiés.',
  'cut-threat-counts': {
    one: 'Menaces copiées : {copied}, dont {removed} supprimée avec son dernier élément.',
    many: 'Menaces copiées : {copied}, dont {removed} de menaces supprimées avec leur dernier élément.',
    other:
      'Menaces copiées : {copied}, dont {removed} supprimées avec leur dernier élément.',
  },
  'cut-remains':
    'Une menace qui ne reste rattachée à rien est supprimée, et une menace rattachée ailleurs reste au registre. Les autres flux rattachés gardent des extrémités libres.',
  'cut-abandoned':
    'La sélection a changé pendant la copie. Rien n’a été coupé.',
  'records-counts': 'Fiches liées : {linked}. Fiches clonées : {cloned}.',
  'node-moved': 'Sélection déplacée. Nouvelle position, x : {x}, y : {y}.',
  'flow-controls': 'Commandes du canevas',
  'toggle-interactivity': 'Activer ou désactiver la modification',
  minimap: 'Vue d’ensemble du diagramme',
  handle: 'Point de connexion',
  'element-role': 'élément',
  'flow-role': 'flux',
  'resize-top': 'Redimensionner {element} par le haut',
  'resize-right': 'Redimensionner {element} par la droite',
  'resize-bottom': 'Redimensionner {element} par le bas',
  'resize-left': 'Redimensionner {element} par la gauche',
  'resize-top-left': 'Redimensionner {element} par le coin supérieur gauche',
  'resize-top-right': 'Redimensionner {element} par le coin supérieur droit',
  'resize-bottom-right': 'Redimensionner {element} par le coin inférieur droit',
  'resize-bottom-left': 'Redimensionner {element} par le coin inférieur gauche',
});
