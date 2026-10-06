import { catalogue } from '@saerskriven/i18n';
import { shellMessages } from './contract.js';

export const shellEnCA = catalogue(shellMessages)('en-CA')({
  language: 'Language',
  'landing-title': 'Saerskriven: Threat Modelling for Developers',
  'development-version': '{version} (development)',
  stopped: 'Saerskriven stopped',
  'stopped-explanation':
    'The studio ran into something it has no handling for. Reloading uses the last completed recovery snapshot. Work after a failed recovery write may be gone.',
  reload: 'Reload the studio',
});
