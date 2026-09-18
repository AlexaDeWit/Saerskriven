import { catalogue } from '@saerskriven/i18n';
import { menuMessages } from './contract.js';

export const menuFrCA = catalogue(menuMessages)('fr-CA')({
  menu: 'Menu',
  'menu-unsaved': 'Menu, modifications non enregistrées',
  project: 'Projet',
  'view-source': 'Voir le code source sur GitHub',
  cancel: 'Annuler',
  'discard-and-open': 'Abandonner les modifications et ouvrir',
  'discard-and-import': 'Abandonner les modifications et importer',
  'discard-and-new': 'Abandonner les modifications et créer un nouveau modèle',
  'save-as-format': 'Enregistrer en {format}',
  'file-state-dirty': '{name}, {format}, modifications non enregistrées',
  'file-state-clean': '{name}, {format}, aucune modification non enregistrée',
  arrange: 'Disposer',
  export: 'Exporter',
  appearance: 'Apparence',
  'appearance-chosen': 'Apparence {mode}',
  'language-chosen': 'Langue {language}',
  'snap-on': 'Alignement sur la grille : activé',
  'snap-off': 'Alignement sur la grille : désactivé',
  diagram: 'Diagramme',
  'no-diagram': 'Aucun diagramme',
  'diagram-named': 'Diagramme : {title}',
});
