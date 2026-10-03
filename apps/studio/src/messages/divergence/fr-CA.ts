import { catalogue } from '@saerskriven/i18n';
import { divergenceMessages } from './contract.js';

export const divergenceFrCA = catalogue(divergenceMessages)('fr-CA')({
  line: '{subject} : {detail}',
  kept: '{line}. Réenregistrer ce fichier n’en perd rien.',
  threat: 'la menace {number} « {title} »',
  'threat-untitled': 'la menace {number}',
  'subject-threat': 'Menace {number} « {title} »',
  'subject-threat-untitled': 'Menace {number}',
  'subject-diagram': 'Diagramme « {title} »',
  'subject-actor': 'Acteur',
  'subject-actor-named': 'Acteur « {name} »',
  'subject-process': 'Processus',
  'subject-process-named': 'Processus « {name} »',
  'subject-store': 'Magasin de données',
  'subject-store-named': 'Magasin de données « {name} »',
  'subject-text': 'Texte',
  'subject-text-named': 'Texte « {name} »',
  'subject-flow-named': 'Flux « {name} »',
  'subject-trust-boundary': 'Frontière de confiance',
  'subject-trust-boundary-named': 'Frontière de confiance « {name} »',
  'subject-mitigation': 'Mesure « {title} »',
  'subject-mitigation-on': 'Mesure de {threat}',
  'subject-mitigation-untitled': 'Mesure',
  'subject-assumption-on': 'Hypothèse de {threat}',
  'subject-assumption-on-model': 'Hypothèse du modèle',
  'subject-assumption': 'Hypothèse',
  'whole-threat': 'la menace entière',
  'whole-mitigation': 'la mesure entière',
  'whole-assumption': 'l’hypothèse entière',
  'split-into-copies': {
    one: 'un seul enregistrement, désormais {count} copie',
    many: 'un seul enregistrement, désormais {count} de copies',
    other: 'un seul enregistrement, désormais {count} copies',
  },
  'note-name-dropped': 'son nom',
  'scope-marking-dropped': 'son marquage hors périmètre',
  'threat-attachment-stray-text': 'son rattachement au texte',
  'threat-attachment-stray-text-named': 'son rattachement au texte « {name} »',
  'threat-attachment-stray-trust-boundary':
    'son rattachement à la frontière de confiance',
  'threat-attachment-stray-trust-boundary-named':
    'son rattachement à la frontière de confiance « {name} »',
  'threat-attachment-stray-unknown': 'son rattachement à un élément absent',
  'threat-category-unnamed':
    'sa catégorie, qui se rouvre comme catégorie personnalisée',
  'mitigation-records-merged': {
    one: 'sa {count} mesure, désormais une seule sans titre',
    many: 'ses {count} de mesures, désormais une seule sans titre',
    other: 'ses {count} mesures, désormais une seule sans titre',
  },
  'mitigation-title-merged': 'le titre de sa mesure, désormais dans le texte',
  'mitigation-status-dropped': '{status}, {inferred} à la réouverture',
  'threat-status-unmapped': 'son état « {status} »',
  'threat-severity-unmapped': 'sa gravité « {severity} »',
  'threat-category-eop-suit': 'sa carte Elevation of Privilege',
  'threat-category-unmapped': 'sa catégorie « {category} »',
  'key-undeclared': 'Clé {path} : non lue',
  'assumption-element-links-dropped': 'ses liens vers des éléments',
  'otm-threat-split': 'Menace « {id} » : une menace par occurrence',
  'otm-threat-status-unmapped':
    'État de menace « {status} » : lu comme ouvert, gardé dans la description',
  'otm-mitigation-split': 'Mesure « {id} » : une mesure par occurrence',
  'otm-mitigation-status-retained':
    'Mesure « {id} » : état « {status} » lu comme proposé, gardé dans sa description',
  'otm-mitigation-unlinked':
    'Mesure « {id} » : sans menace, désormais une ligne de la description du modèle',
  'otm-assets-as-descriptions':
    'Actifs : désormais des descriptions sur les flux et les composants, plus partagés',
  'otm-components-as-processes':
    'Types de composants : désormais des processus, gardés dans les descriptions',
  'tmbom-control-proposed':
    'Contrôle « {name} » : état lu comme proposé, gardé dans sa description',
  'tmbom-control-unlinked':
    'Contrôle « {name} » : sans menace, désormais une ligne de la description du modèle',
  'tmbom-flow-fields-as-prose':
    'Chiffrement et sensibilité des flux : désormais du texte de description',
  'tmbom-data-set-as-prose':
    'Jeu de données « {name} » : désormais du texte sur ses magasins de données, plus partagé',
  'tmbom-data-set-dropped':
    'Jeu de données « {name} » : sur aucun magasin de données, non importé',
  'field-not-retained': 'Champ {path} : non importé',
});
