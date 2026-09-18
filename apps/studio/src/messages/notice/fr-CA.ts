import { catalogue } from '@saerskriven/i18n';
import { noticeMessages } from './contract.js';

export const noticeFrCA = catalogue(noticeMessages)('fr-CA')({
  problems: 'Problèmes',
  dismiss: 'Masquer le problème',
  'refusal-details': {
    one: '{count} détail du refus',
    many: '{count} de détails du refus',
    other: '{count} détails du refus',
  },
  'operation-refused': 'Le modèle a refusé la modification.',
  'file-unreachable': 'Saerskriven n’a pas pu accéder au fichier.',
  'recovery-rejected':
    'Saerskriven a rejeté l’instantané de récupération enregistré.',
  'recovery-unavailable': 'La récupération locale n’est pas disponible.',
  'no-format-claimed': 'Aucun format n’a reconnu {name}.',
  'formats-tried': 'Saerskriven a essayé {formats}.',
  'read-limit': '{name} dépasse une limite de lecture, alors rien ne l’a lu.',
  'read-limit-detail':
    '{limit} : la limite est de {bound}, le fichier a atteint {observed}.',
  'malformed-text':
    '{name} n’est pas un texte valide du format qui l’a reconnu.',
  'invalid-document':
    '{name} n’est pas un document valide du format qui l’a reconnu.',
  'invalid-model':
    '{name} est un document valide, mais le modèle qui en découle ne l’est pas.',
  'snapshot-limit-detail':
    '{limit} : la limite est de {bound}, l’instantané a atteint {observed}.',
  'snapshot-unsupported':
    'L’instantané enregistré est mal formé ou non pris en charge.',
  'snapshot-earlier-release':
    'Une version antérieure de Saerskriven a enregistré cette session sous une forme que cette version ne peut pas restaurer.',
  'snapshot-release':
    'Saerskriven {release} a enregistré cette session sous une forme que cette version ne peut pas restaurer.',
  'field-not-saved': 'Champ non enregistré : {field}.',
  'refused-character':
    'Le caractère {position} est un caractère que le modèle n’accepte pas.',
  'empty-name': 'Un nom ne peut pas être vide.',
  'op-element-properties': 'Les propriétés de l’élément ont été refusées.',
  'op-element-relationships':
    'L’élément a des relations de frontière invalides.',
  'op-fragment': 'Le graphe copié a été refusé.',
  'op-unknown-diagram': 'Le modèle ne contient aucun diagramme {id}.',
  'op-duplicate-diagram': 'Le modèle contient déjà un diagramme {id}.',
  'op-empty-title': 'Le diagramme {id} ne peut pas rester sans titre.',
  'op-title-character':
    'Le titre du diagramme {id} contient un caractère que le modèle n’accepte pas.',
  'op-diagram-not-empty': {
    one: 'Le diagramme {id} ne peut pas être supprimé tant qu’il contient des éléments, et il en contient {count}.',
    many: 'Le diagramme {id} ne peut pas être supprimé tant qu’il contient des éléments, et il en contient {count}.',
    other:
      'Le diagramme {id} ne peut pas être supprimé tant qu’il contient des éléments, et il en contient {count}.',
  },
  'op-unknown-element': 'Le modèle ne contient aucun élément {id}.',
  'op-unknown-threat': 'Le modèle ne contient aucune menace {id}.',
  'op-unknown-mitigation': 'Le modèle ne contient aucune mesure {id}.',
  'op-unknown-assumption': 'Le modèle ne contient aucune hypothèse {id}.',
  'op-duplicate-element': 'Le modèle contient déjà un élément {id}.',
  'op-duplicate-threat': 'Le modèle contient déjà une menace {id}.',
  'op-duplicate-mitigation': 'Le modèle contient déjà une mesure {id}.',
  'op-duplicate-assumption': 'Le modèle contient déjà une hypothèse {id}.',
  'op-mitigation-without-threat':
    'La mesure {id} n’est liée à aucune menace, et une mesure s’ajoute sur une menace.',
  'op-assumption-without-threat':
    'L’hypothèse {id} n’est liée à aucune menace, et une hypothèse s’ajoute sur une menace.',
  'op-assumption-without-reference':
    'L’hypothèse {id} n’est liée à aucune menace et ne s’applique pas au modèle.',
  'op-reused-number': 'Le numéro de menace {number} a déjà été attribué.',
  'op-changed-number':
    'La menace {id} ne peut pas prendre le numéro {number}, un numéro n’étant attribué qu’une fois.',
  'op-source-endpoint':
    'La source du flux désigne {id}, qui ne peut pas en être une.',
  'op-target-endpoint':
    'La destination du flux désigne {id}, qui ne peut pas en être une.',
  'op-not-resizable': 'L’élément {id} n’a pas de taille à définir.',
  'op-not-note': 'L’élément {id} n’est pas une note du canevas.',
  'op-not-flow': 'L’élément {id} n’est pas un flux.',
  'op-empty-name': 'L’élément {id} ne peut pas rester sans nom.',
  'op-element-character':
    'Le texte de l’élément {id} contient un caractère que le modèle n’accepte pas.',
  'op-model-title-character':
    'Le titre du modèle contient un caractère que le modèle n’accepte pas.',
  'op-model-owner-character':
    'Le responsable du modèle contient un caractère que le modèle n’accepte pas.',
  'op-model-description-character':
    'La description du modèle contient un caractère que le modèle n’accepte pas.',
  'op-contributor-character':
    'L’entrée {entry} des contributeurs contient un caractère que le modèle n’accepte pas.',
});
