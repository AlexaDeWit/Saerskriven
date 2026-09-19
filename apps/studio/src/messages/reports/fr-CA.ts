import { catalogue } from '@saerskriven/i18n';
import { reportMessages } from './contract.js';

export const reportsFrCA = catalogue(reportMessages)('fr-CA')({
  region: 'Rapports de fichier',
  opened:
    'L’ouverture du fichier a laissé de côté ce qu’il contient et que Saerskriven ne prend pas en charge :',
  imported:
    'L’importation a créé un modèle natif avec ces conversions et omissions :',
  saved:
    'Le dernier enregistrement n’a pas conservé tout ce que contient le modèle :',
  'conversion-details': {
    one: '{count} détail de conversion',
    many: '{count} de détails de conversion',
    other: '{count} détails de conversion',
  },
  'dismiss-report': 'Masquer le rapport',
  'dismiss-export': 'Masquer le rapport d’exportation',
  'write-refused': 'Saerskriven n’a pas pu écrire l’exportation.',
  'compiler-unavailable': 'Saerskriven n’a pas pu charger le compilateur PDF.',
  'rasterizer-unavailable':
    'Saerskriven n’a pas pu charger le rastériseur SVG.',
  'asset-answered': '{url} a répondu {status}.',
  'face-missing':
    'Cette version du studio ne contient pas {face}, la police du texte.',
  'compile-refused': 'Saerskriven n’a pas pu compiler le PDF.',
  'no-pdf': 'Le compilateur Typst n’a produit aucun PDF.',
  'draw-refused': 'Saerskriven n’a pas pu dessiner le PNG.',
  unplaced:
    'Une extrémité de flux désigne un élément que le canevas ne dessine pas comme une boîte, alors ce flux n’est pas dans le dessin.',
  'unplaced-source': 'La source du flux {flow} désigne {element}.',
  'unplaced-target': 'La destination du flux {flow} désigne {element}.',
  'svg-file': 'Image SVG',
  'png-file': 'Image PNG',
  'markdown-file': 'Document Markdown',
  'typst-file': 'Document Typst',
  'pdf-file': 'Document PDF',
});
