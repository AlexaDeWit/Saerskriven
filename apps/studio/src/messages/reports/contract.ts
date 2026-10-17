import { plural, text } from '@saerskriven/i18n';

const endpoint = { flow: 'text', element: 'text' } as const;

/**
 * The reports under the chrome card: what a file crossing cost or converted,
 * the notice a file opens with when Saerskriven does not write its format,
 * what an export left out or could not do, the file types an export offers,
 * and the link Share copied or could not write.
 */
export const reportMessages = {
  region: text(),
  converted: text(),
  opened: text(),
  'opened-read-only': text({ format: 'text' }),
  saved: text(),
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
  shared: plural('length'),
  'shared-disclosure': text(),
  'share-too-large': text(),
  'share-refused': text(),
  'share-clipboard-refused': text(),
  'dismiss-share': text(),
  unplaced: text(),
  'unplaced-source': text(endpoint),
  'unplaced-target': text(endpoint),
  'svg-file': text(),
  'png-file': text(),
  'markdown-file': text(),
  'typst-file': text(),
  'pdf-file': text(),
} as const;
