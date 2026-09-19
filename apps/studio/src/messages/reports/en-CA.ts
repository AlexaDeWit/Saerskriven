import { catalogue } from '@saerskriven/i18n';
import { reportMessages } from './contract.js';

export const reportsEnCA = catalogue(reportMessages)('en-CA')({
  region: 'File reports',
  opened: 'Opening the file dropped what it holds and Saerskriven does not:',
  imported:
    'Import created a native model with these conversions and omissions:',
  saved: 'The last save did not carry everything the model holds:',
  'conversion-details': {
    one: '{count} conversion detail',
    other: '{count} conversion details',
  },
  'dismiss-report': 'Dismiss report',
  'dismiss-export': 'Dismiss export report',
  'write-refused': 'Saerskriven could not write the export.',
  'compiler-unavailable': 'Saerskriven could not load the PDF compiler.',
  'rasterizer-unavailable': 'Saerskriven could not load the SVG rasterizer.',
  'asset-answered': '{url} answered {status}.',
  'face-missing': 'This studio build holds no {face}, which text is set in.',
  'compile-refused': 'Saerskriven could not compile the PDF.',
  'no-pdf': 'The Typst compiler produced no PDF.',
  'draw-refused': 'Saerskriven could not draw the PNG.',
  unplaced:
    'A flow endpoint names an element the canvas draws as no box, so its flow is not in the drawing.',
  'unplaced-source': 'The source of flow {flow} names {element}.',
  'unplaced-target': 'The target of flow {flow} names {element}.',
  'svg-file': 'SVG image',
  'png-file': 'PNG image',
  'markdown-file': 'Markdown document',
  'typst-file': 'Typst document',
  'pdf-file': 'PDF document',
});
