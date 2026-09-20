import { catalogue } from '@saerskriven/i18n';
import { issueMessages } from './contract.js';

export const issuesFrCA = catalogue(issueMessages)('fr-CA')({
  line: '{path} : {detail}',
  'line-root': 'Le document dans son ensemble : {detail}',
  'kind-string': 'un texte',
  'kind-number': 'un nombre',
  'kind-integer': 'un nombre entier',
  'kind-boolean': 'une valeur vraie ou fausse',
  'kind-array': 'une liste',
  'kind-object': 'un enregistrement',
  'kind-date': 'une date',
  'kind-null': 'la valeur nulle',
  'kind-undefined': 'rien',
  'kind-other': 'une valeur d’un autre genre',
  'referent-component': 'composant',
  'referent-asset': 'actif',
  'referent-threat': 'menace',
  'referent-mitigation': 'mesure',
  'referent-trust-zone': 'zone de confiance',
  'referent-endpoint': 'extrémité',
  'referent-data-store': 'entrepôt de données',
  'type-mismatch': '{expected} était attendu et {received} a été trouvé',
  'value-unexpected': 'une valeur parmi {values} était attendue',
  'option-unmatched': 'aucune option déclarée n’accepte cette valeur',
  'too-small-characters': {
    one: 'au moins {bound} caractère était attendu',
    many: 'au moins {bound} de caractères étaient attendus',
    other: 'au moins {bound} caractères étaient attendus',
  },
  'too-small-items': {
    one: 'au moins {bound} entrée était attendue',
    many: 'au moins {bound} d’entrées étaient attendues',
    other: 'au moins {bound} entrées étaient attendues',
  },
  'too-small-value': 'une valeur d’au moins {bound} était attendue',
  'too-small-above': 'une valeur supérieure à {bound} était attendue',
  'too-big-characters': {
    one: 'au plus {bound} caractère était attendu',
    many: 'au plus {bound} de caractères étaient attendus',
    other: 'au plus {bound} caractères étaient attendus',
  },
  'too-big-items': {
    one: 'au plus {bound} entrée était attendue',
    many: 'au plus {bound} d’entrées étaient attendues',
    other: 'au plus {bound} entrées étaient attendues',
  },
  'too-big-value': 'une valeur d’au plus {bound} était attendue',
  'too-big-below': 'une valeur inférieure à {bound} était attendue',
  'format-mismatch': 'le texte ne correspond pas au format {format}',
  'value-refused': 'la valeur n’est pas acceptée ici ({kind})',
  'text-character-refused': 'le texte porte un caractère que le modèle refuse',
  'element-kind-changed':
    'les propriétés doivent correspondre au genre de l’élément',
  'duplicate-element-id':
    'l’identifiant d’élément « {id} » est déjà pris, et les identifiants d’élément sont uniques dans tout le modèle',
  'duplicate-diagram-id':
    'l’identifiant de diagramme « {id} » est déjà pris, et les identifiants de diagramme sont uniques dans tout le modèle',
  'duplicate-threat-id':
    'l’identifiant de menace « {id} » est déjà pris, et les identifiants de menace sont uniques parmi les menaces',
  'duplicate-mitigation-id':
    'l’identifiant de mesure « {id} » est déjà pris, et les identifiants de mesure sont uniques parmi les mesures',
  'duplicate-assumption-id':
    'l’identifiant d’hypothèse « {id} » est déjà pris, et les identifiants d’hypothèse sont uniques parmi les hypothèses',
  'duplicate-identifier': 'l’identifiant « {id} » est employé deux fois',
  'duplicate-threat-number':
    'le numéro de menace {number} est déjà pris, et les numéros de menace sont uniques dans tout le modèle',
  'threat-number-above-issued':
    'le numéro de menace {number} dépasse le dernier numéro attribué {issued}',
  'flow-endpoint-self':
    'le flux nomme son propre identifiant « {id} », et un flux ne peut pas s’ancrer à lui-même',
  'flow-endpoint-foreign':
    'l’élément « {id} » ne se trouve pas dans le diagramme du flux',
  'unknown-element-reference':
    'aucun élément du modèle ne porte l’identifiant « {id} »',
  'unknown-threat-reference':
    'aucune menace du modèle ne porte l’identifiant « {id} »',
  'related-element-unknown':
    '« {id} » ne nomme aucun autre élément du diagramme de l’élément',
  'related-boundary-unknown':
    '« {id} » ne nomme aucune frontière de confiance du diagramme de l’élément',
  'related-flow-unknown':
    '« {id} » ne nomme aucun flux du diagramme de l’élément',
  'unknown-source-reference':
    'le document source ne déclare aucun {kind} « {id} »',
  'import-format-unnamed':
    'une importation exige une version OTM ou une adresse de schéma TM-BOM',
  'issue-flood':
    'le fichier porte plus de problèmes qu’une analyse ne peut en énumérer',
  'schema-threw': 'l’analyse s’est arrêtée : {reason}',
});
