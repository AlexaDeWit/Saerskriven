import { catalogue } from '@saerskriven/i18n';
import { reportMessages } from './contract.js';

export const reportsSv = catalogue(reportMessages)('sv')({
  region: 'Filrapporter',
  converted: 'Konverterades vid öppningen:',
  opened: 'Visas inte i studion:',
  'opened-read-only':
    'En {format}-fil öppnas som en ny modell. Saerskriven skriver inte {format}, så Spara skapar en Saerskriven-fil. Den öppnade filen lämnas som den är.',
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
  shared: {
    one: 'Länken till modellen finns i urklipp, {length} tecken lång.',
    other: 'Länken till modellen finns i urklipp, {length} tecken lång.',
  },
  'shared-disclosure': 'Alla som har länken kan läsa hela modellen.',
  'share-too-large':
    'Modellen är för stor för en länk. Spara den som en fil för att dela den.',
  'share-refused': 'Saerskriven kunde inte skriva länken.',
  'share-clipboard-refused':
    'Webbläsaren lät inte Saerskriven lägga länken i urklipp.',
  'dismiss-share': 'Dölj länkrapporten',
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
