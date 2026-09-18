import { plural, text } from '@saerskriven/i18n';

const endpoint = { flow: 'text', element: 'text' } as const;

/**
 * The reports under the chrome card: what a file crossing cost, what an
 * export left out or could not do, and the file types an export offers.
 */
export const reportMessages = {
  region: text(),
  opened: text(),
  imported: text(),
  saved: text(),
  'conversion-details': plural('count'),
  'dismiss-report': text(),
  'dismiss-export': text(),
  'write-refused': text(),
  'compiler-unavailable': text(),
  'rasterizer-unavailable': text(),
  'asset-answered': text({ url: 'text', status: 'text' }),
  'face-missing': text({ face: 'text' }),
  'compile-refused': text(),
  'no-pdf': text(),
  'draw-refused': text(),
  unplaced: text(),
  'unplaced-source': text(endpoint),
  'unplaced-target': text(endpoint),
  'svg-file': text(),
  'png-file': text(),
  'markdown-file': text(),
  'typst-file': text(),
  'pdf-file': text(),
} as const;
