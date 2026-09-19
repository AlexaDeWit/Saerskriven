import { catalogue } from '@saerskriven/i18n';
import { shellMessages } from './contract.js';

export const shellSv = catalogue(shellMessages)('sv')({
  language: 'Språk',
  'landing-title': 'Saerskriven: studio för hotmodellering med öppen källkod',
  'development-version': '{version} (utveckling)',
  stopped: 'Saerskriven har slutat fungera',
  'stopped-explanation':
    'Studion stötte på något som den inte kan hantera. En omladdning använder den senaste fullständiga återställningsögonblicksbilden. Arbete efter en misslyckad återställningsskrivning kan ha gått förlorat.',
  reload: 'Ladda om studion',
});
