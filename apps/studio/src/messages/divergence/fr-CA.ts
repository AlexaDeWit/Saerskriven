import { catalogue } from '@saerskriven/i18n';
import { divergenceMessages } from './contract.js';

export const divergenceFrCA = catalogue(divergenceMessages)('fr-CA')({
  line: '{subject} : {detail} ({reason})',
  'subject-model': 'le modèle',
  'subject-diagram': 'le diagramme « {id} »',
  'subject-element': "l'élément « {id} »",
  'subject-threat': 'la menace « {id} »',
  'subject-mitigation': 'la mesure « {id} »',
  'subject-assumption': "l'hypothèse « {id} »",
  'reason-unrepresentable': 'aucune place dans le format',
  'reason-undeclared': 'non déclaré par le schéma de fichier',
  'reason-narrowed': 'réduit pour tenir dans le format',
  'reason-split': 'scindé par le format',
  'reason-overridden': 'non repris par le codec',
  'reason-discarded-by-edit': 'retiré par une modification',
  'release-restamped':
    "la version « {from} » qui a écrit la source, au profit de la version {written} qu'écrit ce codec",
  'threat-mark-raised-by-issue':
    'le plafond de numéros de menace {from}, porté à {raised} pour couvrir un numéro attribué par cette écriture',
  'threat-mark-raised-to-issued':
    "le plafond de numéros de menace {from}, porté à {raised}, le plus grand numéro attribué par le modèle et qu'aucun numéro du fichier n'atteint",
  'diagram-mark-raised-by-issue':
    'le plafond de numéros de diagramme {from}, porté à {raised} pour couvrir un numéro attribué par cette écriture',
  'diagram-mark-raised-to-issued':
    "le plafond de numéros de diagramme {from}, porté à {raised}, le plus grand numéro attribué par le modèle et qu'aucun numéro du fichier n'atteint",
  'assumption-unrecorded': "l'hypothèse, dont le format ne garde aucune trace",
  'diagram-discarded':
    'le diagramme « {title} » que contenait le document source',
  'threat-copy-detached':
    'la copie que le document source imbriquait sous la cellule « {cell} », à laquelle le modèle ne la rattache plus',
  'threat-discarded':
    'la menace « {title} » que le document source imbriquait sous une cellule conservée par le modèle',
  'note-name-dropped':
    "le nom « {name} », alors que le format ne garde qu'un texte pour une note et aucun nom à côté",
  'scope-marking-dropped':
    'le marquage hors périmètre, que le format ne note que sur les éléments auxquels une menace se rattache',
  'cell-reshaped':
    'ce que la source portait sur la cellule {shape} de cet identifiant, qui dessine maintenant un {kind}',
  'diagram-name-numbered':
    'le nom, le format numérotant un diagramme au lieu de le nommer, écrit comme {number}',
  'cell-discarded': 'la cellule {shape} que contenait le document source',
  'threat-attachment-stray':
    "le rattachement à {kind} « {element} », le format n'imbriquant une menace que sous un acteur, un processus, un dépôt ou un flux",
  'threat-attachment-stray-unknown':
    "le rattachement à l'inconnu « {element} », le format n'imbriquant une menace que sous un acteur, un processus, un dépôt ou un flux",
  'threat-unplaceable':
    "la menace elle-même, le format ne la gardant que sous une cellule et celle-ci n'en nommant aucune où l'imbriquer",
  'threat-split-across-elements': {
    one: "l'enregistrement unique, écrit une fois sous le {count} élément qu'il nomme",
    many: "l'enregistrement unique, écrit une fois sous chacun des {count} d'éléments qu'il nomme",
    other:
      "l'enregistrement unique, écrit une fois sous chacun des {count} éléments qu'il nomme",
  },
  'threat-category-unnamed':
    'la catégorie {methodology} « {category} », que les étiquettes propres à Threat Dragon ne nomment pas',
  'mitigation-records-merged': {
    one: 'le {count} enregistrement fondu dans son unique texte de mesure, qui se relit comme un seul enregistrement sans titre',
    many: "les {count} d'enregistrements fondus dans son unique texte de mesure, qui se relit comme un seul enregistrement sans titre",
    other:
      'les {count} enregistrements fondus dans son unique texte de mesure, qui se relit comme un seul enregistrement sans titre',
  },
  'mitigation-title-merged':
    'le titre de la mesure écrit dans son unique texte de mesure, qui se relit comme un seul enregistrement sans titre',
  'mitigation-empty-dropped':
    "la mesure sans titre ni texte, qui n'écrit rien dans le texte de la menace « {threat} »",
  'mitigation-status-dropped':
    "l'état « {status} » dans le texte de la menace « {threat} », qui se relit comme « {inferred} »",
  'mitigation-unlinked':
    "la mesure « {name} », qui n'est liée à aucune menace que le format garde",
  'mitigation-split-across-threats': {
    one: 'l’enregistrement unique, écrit dans le texte de mesure de la {count} menace à laquelle il est lié',
    many: "l'enregistrement unique, écrit dans le texte de mesure de chacune des {count} de menaces auxquelles il est lié",
    other:
      "l'enregistrement unique, écrit dans le texte de mesure de chacune des {count} menaces auxquelles il est lié",
  },
  'threat-status-unmapped':
    "l'état « {status} », pour lequel le modèle n'a aucun état",
  'threat-severity-unmapped':
    "la gravité « {severity} », pour laquelle le modèle n'a aucun niveau",
  'threat-category-eop-suit':
    'la carte Elevation of Privilege, dont le modèle ne garde que la couleur',
  'threat-category-unmapped':
    "la catégorie « {category} », qu'aucune langue de Threat Dragon ne nomme",
  'key-undeclared': 'la clé {path}',
  'assumption-element-links-dropped':
    "ses liens vers des éléments, qu'une hypothèse ne garde pas",
  'otm-threat-split':
    'La menace « {id} » devient un enregistrement distinct par occurrence.',
  'otm-threat-undecided':
    'La menace « {id} » est importée avec une gravité indécise et une catégorie non précisée.',
  'otm-threat-status-unmapped':
    "L'état de menace « {status} » est importé comme ouvert. Le texte d'état fourni reste dans la description.",
  'otm-threat-status-absent':
    "Un état de menace absent est importé comme ouvert. Le texte d'état fourni reste dans la description.",
  'otm-mitigation-split':
    'La mesure « {id} » devient un enregistrement distinct par occurrence.',
  'otm-mitigation-status-retained':
    "La mesure « {id} » porte l'état source « {status} », conservé dans sa description et importé comme proposé.",
  'otm-mitigation-status-absent':
    "La mesure « {id} » n'a aucun état source et est importée comme proposée.",
  'otm-mitigation-unlinked':
    'La mesure « {id} » ne nomme aucune menace et devient une ligne de la description du modèle.',
  'otm-assets-as-descriptions':
    "Les noms d'actifs référencés deviennent des descriptions sur les flux et les composants. L'identité partagée des données n'est pas conservée.",
  'otm-components-as-processes':
    "Les types de composants OTM deviennent des nœuds de processus. Leurs types d'origine restent dans les descriptions.",
  'otm-geometry-generated':
    "L'élément « {id} » reçoit une géométrie générée là où la source n'en a pas.",
  'tmbom-threats-undecided':
    'Les menaces sont importées comme ouvertes, avec une gravité indécise et une catégorie non précisée. Les évaluations de risque distinctes ne sont pas converties en gravité de menace.',
  'tmbom-control-proposed':
    "Le contrôle « {name} » est importé comme proposé. Son état d'origine reste dans la description.",
  'tmbom-control-unlinked':
    'Le contrôle « {name} » ne nomme aucune menace et devient une ligne de la description du modèle.',
  'tmbom-geometry-generated':
    "Le diagramme reçoit une géométrie générée, groupée par zone de confiance de la source. L'appartenance devient visuelle.",
  'tmbom-flow-fields-as-prose':
    'Les champs de chiffrement et de sensibilité des flux restent en prose dans les descriptions de flux.',
  'tmbom-data-set-as-prose':
    "Le jeu de données « {name} » devient de la prose sur ses dépôts. L'identité partagée des données n'est pas conservée.",
  'tmbom-data-set-dropped':
    "Le jeu de données « {name} » n'a aucun placement sur un dépôt et n'est pas conservé.",
  'field-not-retained':
    "Le champ source {path} n'est pas conservé par l'importation.",
});
