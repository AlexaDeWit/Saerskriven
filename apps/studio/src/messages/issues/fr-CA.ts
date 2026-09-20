import { catalogue } from '@saerskriven/i18n';
import { issueMessages } from './contract.js';

export const issuesFrCA = catalogue(issueMessages)('fr-CA')({
  line: '{path} : {detail}',
  'line-root': 'le document entier : {detail}',
  'kind-string': 'un texte',
  'kind-number': 'un nombre',
  'kind-integer': 'un nombre entier',
  'kind-boolean': 'une valeur vraie ou fausse',
  'kind-array': 'une liste',
  'kind-object': 'un objet',
  'kind-date': 'une date',
  'kind-null': 'la valeur nulle',
  'kind-undefined': 'une valeur absente',
  'kind-other': 'une valeur d’un autre genre',
  'format-regex': 'le texte ne correspond pas au motif déclaré par le schéma',
  'format-url': 'le texte n’est pas une adresse web',
  'format-date': 'le texte n’est pas une date ISO',
  'format-datetime': 'le texte n’est pas une date et une heure ISO',
  'format-other': 'le texte ne correspond pas au format déclaré par le schéma',
  'source-component-unknown':
    'le document source ne déclare aucun composant « {id} »',
  'source-asset-unknown': 'le document source ne déclare aucun actif « {id} »',
  'source-threat-unknown':
    'le document source ne déclare aucune menace « {id} »',
  'source-mitigation-unknown':
    'le document source ne déclare aucune mesure « {id} »',
  'source-trust-zone-unknown':
    'le document source ne déclare aucune zone de confiance « {id} »',
  'source-endpoint-unknown':
    'le document source ne déclare aucune extrémité « {id} »',
  'source-data-store-unknown':
    'le document source ne déclare aucun magasin de données « {id} »',
  'type-mismatch': 'devait être {expected} mais est {received}',
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
  'value-refused': 'la valeur n’est pas acceptée ici',
  'operation-unknown': 'aucune opération de ce serveur ne l’applique',
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
  'import-format-unnamed':
    'une importation exige une version OTM ou une adresse de schéma TM-BOM',
  'issue-flood':
    'le fichier porte plus de problèmes qu’une analyse ne peut en énumérer',
  'schema-threw':
    'l’analyse s’est arrêtée avant de pouvoir dire ce qui ne va pas',
});
