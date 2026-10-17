import { catalogue } from '@saerskriven/i18n';
import { reportMessages } from './contract.js';

export const reportsFrCA = catalogue(reportMessages)('fr-CA')({
  region: 'Rapports de fichier',
  converted: 'Converti à l’ouverture :',
  opened: 'Non affiché dans le studio :',
  'opened-read-only':
    'Un fichier {format} s’ouvre comme un nouveau modèle. Saerskriven n’écrit pas en {format}, alors Enregistrer crée un fichier Saerskriven. Le fichier ouvert reste tel quel.',
  saved: 'Non conservé par cet enregistrement :',
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
  shared: {
    one: 'Le lien vers le modèle est dans le presse-papiers : {length} caractère.',
    many: 'Le lien vers le modèle est dans le presse-papiers : {length} de caractères.',
    other:
      'Le lien vers le modèle est dans le presse-papiers : {length} caractères.',
  },
  'shared-disclosure':
    'Quiconque détient le lien peut lire le modèle en entier.',
  'share-too-large':
    'Le modèle est trop volumineux pour un lien. Enregistrez-le dans un fichier pour le partager.',
  'share-refused': 'Saerskriven n’a pas pu écrire le lien.',
  'share-clipboard-refused':
    'Le navigateur n’a pas permis à Saerskriven de mettre le lien dans le presse-papiers.',
  'dismiss-share': 'Masquer le rapport du lien',
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
