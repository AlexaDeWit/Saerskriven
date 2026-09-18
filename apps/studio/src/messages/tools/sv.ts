import { catalogue } from '@saerskriven/i18n';
import { toolMessages } from './contract.js';

export const toolsSv = catalogue(toolMessages)('sv')({
  'diagram-region': 'Diagram',
  'free-point': 'en fri punkt',
  'flow-between': 'mellan {source} och {target}',
  'flow-from-to': 'från {source} till {target}',
  'open-threats': {
    one: '{count} öppet hot',
    other: '{count} öppna hot',
  },
  'severity-not-assessed': 'allvarlighet ej bedömd',
  'highest-severity': 'högsta allvarlighet {severity}',
  'zoom-and-fit': 'Zoom och anpassning',
  'current-zoom': 'Aktuell zoom: {percent} %.',
  'flow-target': 'Flödets mål',
  'choose-flow-target': 'Välj ett mål för flödet',
  'reconnect-flow': 'Koppla om flödet',
  'flow-endpoint': 'Flödets ände',
  'select-node-geometry': 'Markera en nod för att ändra dess geometri.',
  'select-one-flow': 'Markera ett enda flöde för att koppla om det.',
  close: 'Stäng',
  cancel: 'Avbryt',
  'apply-geometry': 'Tillämpa geometrin',
  'apply-endpoint': 'Tillämpa änden',
  'axis-x': 'X',
  'axis-y': 'Y',
  width: 'Bredd',
  height: 'Höjd',
  decrease: 'Minska {label}',
  increase: 'Öka {label}',
  source: 'Källa',
  target: 'Mål',
  side: 'Sida',
  automatic: 'Automatiskt',
  'flow-route': 'Flödets sträckning',
  'bend-actions': 'Åtgärder för knäckpunkten',
  'flow-end-actions': 'Åtgärder för flödesänden',
  'bend-numbered': 'Knäckpunkt {number}',
  'flow-source-end': 'Flödets källände',
  'flow-target-end': 'Flödets målände',
  'remove-bend': 'Ta bort knäckpunkten',
  'move-bend': 'Flytta knäckpunkten',
  'follow-route': 'Följ sträckningen',
  'bend-handle-help':
    'Dra eller använd piltangenterna för att flytta. Klicka för åtgärder. Delete tar bort knäckpunkten.',
  'flow-end-handle-help':
    'Dra till en annan sida av sitt objekt. Piltangenterna fäster en sida, Delete låter den följa sträckningen. Klicka för åtgärder.',
  'bend-choose-help':
    'Segment {number}: Vänster/Höger för att välja, Retur för att lägga till. Eller klicka på ett segment.',
  'bend-place-help':
    'Piltangenterna flyttar knäckpunkten. Retur bekräftar, Escape avbryter. Eller klicka på målet.',
  'bend-idle-help':
    'Dra i linjen för att lägga till en knäckpunkt. Dra en knäckpunkt för att flytta den. Dra en ände till en annan sida av sitt objekt. Klicka på ett handtag för åtgärder.',
});
