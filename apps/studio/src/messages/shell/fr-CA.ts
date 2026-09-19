import { catalogue } from '@saerskriven/i18n';
import { shellMessages } from './contract.js';

export const shellFrCA = catalogue(shellMessages)('fr-CA')({
  language: 'Langue',
  'landing-title':
    'Saerskriven : studio de modélisation des menaces à code source ouvert',
  'development-version': '{version} (développement)',
  stopped: 'Saerskriven s’est arrêté',
  'stopped-explanation':
    'Le studio a rencontré une situation qu’il ne sait pas traiter. Le rechargement utilise le dernier instantané de récupération terminé. Le travail postérieur à une écriture de récupération échouée peut être perdu.',
  reload: 'Recharger le studio',
});
