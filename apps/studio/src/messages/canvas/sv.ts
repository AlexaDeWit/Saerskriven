import { catalogue } from '@saerskriven/i18n';
import { canvasMessages } from './contract.js';

export const canvasSv = catalogue(canvasMessages)('sv')({
  quoted: '”{text}”',
  'snap-on': 'Fäst mot rutnätet på.',
  'snap-off': 'Fäst mot rutnätet av.',
  'diagram-shown': 'Visar ”{title}”.',
  'diagram-added': 'Lade till ”{title}”.',
  'diagram-renamed': 'Bytte namn på diagrammet till ”{title}”.',
  'selection-cleared': 'Markeringen rensades.',
  'geometry-updated': 'Position och storlek uppdaterades.',
  'geometry-invalid': 'Ange ändliga koordinater och positiva mått.',
  arranged: {
    one: 'Ordnade {count} nod. Flödenas knäckpunkter och fria ändar ligger kvar.',
    other:
      'Ordnade {count} noder. Flödenas knäckpunkter och fria ändar ligger kvar.',
  },
  'source-changed': 'Ändrade flödets källa.',
  'target-changed': 'Ändrade flödets mål.',
  'flow-both-ways': 'Ändrade {flow} till att gå åt båda hållen.',
  'flow-one-way': 'Ändrade {flow} till att gå åt ett håll.',
  'flow-reversed': 'Vände riktningen på {flow}.',
  'boundary-curved': 'Ändrade {boundary} till en kurva.',
  'boundary-boxed': 'Ändrade {boundary} till en rektangel.',
  'point-moved': 'Flyttade punkt {number} på {boundary}.',
  'point-removed': 'Tog bort punkt {number} från {boundary}.',
  'point-kept': 'En förtroendegränskurva behåller minst två punkter.',
  'removed-named': 'Tog bort {name}.',
  'removed-elements': {
    one: 'Tog bort {count} objekt.',
    other: 'Tog bort {count} objekt.',
  },
  'flows-detached': {
    one: '{count} flöde lossades.',
    other: '{count} flöden lossades.',
  },
  'threat-links-dropped': {
    one: '{count} hotlänk togs bort.',
    other: '{count} hotlänkar togs bort.',
  },
  'threats-removed': {
    one: '{count} hot togs bort.',
    other: '{count} hot togs bort.',
  },
  'bend-added': 'Lade till knäckpunkt {number} på {flow}.',
  'bend-moved': 'Flyttade knäckpunkt {number} på {flow}.',
  'bend-removed': 'Tog bort knäckpunkt {number} från {flow}.',
  'bend-at': 'Knäckpunkt vid x {x}, y {y}.',
  'source-released':
    'Släppte källänden på {flow} så att den följer sträckningen.',
  'target-released':
    'Släppte måländen på {flow} så att den följer sträckningen.',
  'source-pinned': 'Fäste källänden på {flow}. Sida: {side}.',
  'target-pinned': 'Fäste måländen på {flow}. Sida: {side}.',
  'source-freed': 'Lossade källänden på {flow}.',
  'target-freed': 'Lossade måländen på {flow}.',
  'source-moved': 'Flyttade källänden på {flow}.',
  'target-moved': 'Flyttade måländen på {flow}.',
  'free-end-kept': 'En fri flödesände ligger kvar där den är.',
  'position-invalid': 'Ange ändliga koordinater.',
  'undo-done': 'Ångrade.',
  'redo-done': 'Gjorde om.',
  'threat-deleted': 'Hot {number} togs bort.',
  'threat-attached-to-actor': 'Hot {number} kopplades till aktören.',
  'threat-attached-to-actor-named': 'Hot {number} kopplades till {name}.',
  'threat-attached-to-process': 'Hot {number} kopplades till processen.',
  'threat-attached-to-process-named': 'Hot {number} kopplades till {name}.',
  'threat-attached-to-store': 'Hot {number} kopplades till datalagret.',
  'threat-attached-to-store-named': 'Hot {number} kopplades till {name}.',
  'threat-attached-to-text': 'Hot {number} kopplades till texten.',
  'threat-attached-to-text-named': 'Hot {number} kopplades till {name}.',
  'threat-attached-to-flow': 'Hot {number} kopplades till flödet.',
  'threat-attached-to-flow-named': 'Hot {number} kopplades till {name}.',
  'threat-attached-to-trust-boundary':
    'Hot {number} kopplades till förtroendegränsen.',
  'threat-attached-to-trust-boundary-named':
    'Hot {number} kopplades till {name}.',
  'threat-detached-from-actor':
    'Hot {number} kopplades bort från aktören. Det ligger kvar på sina övriga objekt.',
  'threat-detached-from-actor-named':
    'Hot {number} kopplades bort från {name}. Det ligger kvar på sina övriga objekt.',
  'threat-detached-from-process':
    'Hot {number} kopplades bort från processen. Det ligger kvar på sina övriga objekt.',
  'threat-detached-from-process-named':
    'Hot {number} kopplades bort från {name}. Det ligger kvar på sina övriga objekt.',
  'threat-detached-from-store':
    'Hot {number} kopplades bort från datalagret. Det ligger kvar på sina övriga objekt.',
  'threat-detached-from-store-named':
    'Hot {number} kopplades bort från {name}. Det ligger kvar på sina övriga objekt.',
  'threat-detached-from-text':
    'Hot {number} kopplades bort från texten. Det ligger kvar på sina övriga objekt.',
  'threat-detached-from-text-named':
    'Hot {number} kopplades bort från {name}. Det ligger kvar på sina övriga objekt.',
  'threat-detached-from-flow':
    'Hot {number} kopplades bort från flödet. Det ligger kvar på sina övriga objekt.',
  'threat-detached-from-flow-named':
    'Hot {number} kopplades bort från {name}. Det ligger kvar på sina övriga objekt.',
  'threat-detached-from-trust-boundary':
    'Hot {number} kopplades bort från förtroendegränsen. Det ligger kvar på sina övriga objekt.',
  'threat-detached-from-trust-boundary-named':
    'Hot {number} kopplades bort från {name}. Det ligger kvar på sina övriga objekt.',
  'threat-detach-removed':
    'Hot {number} togs bort. Det var inte kopplat till något annat. Ångra återställer det.',
  'record-named': '{kind} ”{label}”',
  'record-unlinked':
    'Tog bort länken till {record}. Posten finns kvar på sina andra referenser.',
  'record-removed':
    'Tog bort {record}. Inget annat använde posten. Ångra återställer den.',
  'copy-nothing-selected': 'Markera objekt att kopiera.',
  'copy-refused': 'Markeringen kunde inte kopieras.',
  'copy-too-large': 'Markeringen överskrider urklippets storleksgräns.',
  'clipboard-write-failed':
    'Det gick inte att skriva till urklipp. Inget klipptes ut. Kontrollera webbläsarens behörighet för urklipp.',
  'clipboard-read-failed':
    'Det gick inte att läsa från urklipp. Kontrollera webbläsarens behörighet för urklipp.',
  'paste-document-changed':
    'Dokumentet ändrades medan urklippet lästes. Klistra in igen.',
  'paste-no-selection':
    'Urklippet innehåller ingen markering från Saerskriven.',
  'paste-invalid':
    'Markeringen i urklippet är ogiltig, stöds inte eller överskrider en läsgräns.',
  'paste-no-diagram': 'Det finns inget diagram att klistra in i.',
  'paste-remap-failed': 'Den kopierade grafen kunde inte få nya id:n.',
  copied: 'Kopierade markeringen.',
  cut: 'Klippte ut markeringen.',
  duplicated: 'Duplicerade markeringen.',
  pasted: 'Klistrade in markeringen med nya id:n för objekt och hot.',
  'copy-counts':
    'Objekt: {elements}. Hot: {threats}. Uteslutna externa länkar: {excluded}.',
  'copy-source-fields':
    'Fält från källformatet som ligger utanför modellen kopieras inte.',
  'cut-threat-counts': {
    one: 'Kopierade hot: {copied}, varav {removed} togs bort med sitt sista objekt.',
    other:
      'Kopierade hot: {copied}, varav {removed} togs bort med sina sista objekt.',
  },
  'cut-remains':
    'Ett hot som blir utan koppling tas bort, och ett hot som är kopplat någon annanstans finns kvar i registret. Andra anslutna flöden behåller fria ändar.',
  'cut-abandoned': 'Markeringen ändrades under kopieringen. Inget klipptes ut.',
  'records-counts': 'Länkade poster: {linked}. Klonade poster: {cloned}.',
  'node-moved': 'Flyttade markeringen. Ny position, x: {x}, y: {y}.',
  'flow-controls': 'Kontroller för arbetsytan',
  'toggle-interactivity': 'Slå på eller av redigering',
  minimap: 'Översikt över diagrammet',
  handle: 'Anslutningspunkt',
  'element-role': 'element',
  'flow-role': 'flöde',
  'resize-top': 'Ändra storlek på {element} från överkanten',
  'resize-right': 'Ändra storlek på {element} från högerkanten',
  'resize-bottom': 'Ändra storlek på {element} från nederkanten',
  'resize-left': 'Ändra storlek på {element} från vänsterkanten',
  'resize-top-left': 'Ändra storlek på {element} från övre vänstra hörnet',
  'resize-top-right': 'Ändra storlek på {element} från övre högra hörnet',
  'resize-bottom-right': 'Ändra storlek på {element} från nedre högra hörnet',
  'resize-bottom-left': 'Ändra storlek på {element} från nedre vänstra hörnet',
});
