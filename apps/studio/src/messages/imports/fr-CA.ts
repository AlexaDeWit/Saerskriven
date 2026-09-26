import { catalogue } from '@saerskriven/i18n';
import { importMessages } from './contract.js';

export const importsFrCA = catalogue(importMessages)('fr-CA')({
  'import-format-unnamed':
    'une importation exige une version OTM ou une adresse de schéma TM-BOM (versions prises en charge : OTM {otm}, TM-BOM {tmbom})',
  'otm-parent-not-single':
    'un parent nomme exactement une zone de confiance ou un composant',
  'duplicate-identifier': 'l’identifiant « {id} » est employé deux fois',
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
});
