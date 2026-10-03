import { catalogue } from '@saerskriven/i18n';
import { reportMessages } from './contract.js';

export const reportsSv = catalogue(reportMessages)('sv')({
  region: 'Filrapporter',
  opened: 'Visas inte i studion:',
  'opened-otm':
    'En OTM-fil öppnas som en ny modell. Saerskriven skriver inte OTM, så Spara skapar en Saerskriven-fil. Den öppnade filen lämnas som den är.',
  'opened-tmbom':
    'En TM-BOM-fil öppnas som en ny modell. Saerskriven skriver inte TM-BOM, så Spara skapar en Saerskriven-fil. Den öppnade filen lämnas som den är.',
  saved: 'Behålls inte av den här sparningen:',
  'dismiss-report': 'Dölj rapporten',
  'dismiss-export': 'Dölj exportrapporten',
  'write-refused': 'Saerskriven kunde inte skriva exporten.',
  'compiler-unavailable': 'Saerskriven kunde inte läsa in PDF-kompilatorn.',
  'rasterizer-unavailable': 'Saerskriven kunde inte läsa in SVG-rastreraren.',
  'asset-answered': '{url} svarade {status}.',
  'face-missing':
    'Den här versionen av studion saknar {face}, som texten sätts i.',
  'compile-refused': 'Saerskriven kunde inte kompilera PDF-filen.',
  'no-pdf': 'Typst-kompilatorn gav ingen PDF.',
  'draw-refused': 'Saerskriven kunde inte rita PNG-bilden.',
  unplaced:
    'En flödesände anger ett objekt som arbetsytan inte ritar som en ruta, så flödet finns inte med i ritningen.',
  'unplaced-source': 'Källan för flöde {flow} anger {element}.',
  'unplaced-target': 'Målet för flöde {flow} anger {element}.',
  'svg-file': 'SVG-bild',
  'png-file': 'PNG-bild',
  'markdown-file': 'Markdown-dokument',
  'typst-file': 'Typst-dokument',
  'pdf-file': 'PDF-dokument',
});
