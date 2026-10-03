import { catalogue } from '@saerskriven/i18n';
import { divergenceMessages } from './contract.js';

export const divergenceSv = catalogue(divergenceMessages)('sv')({
  line: '{subject}: {detail}',
  repeated: { one: '{line}', other: '{line}, {count} gånger' },
  kept: '{line}. Behålls om filen sparas igen.',
  threat: 'hot {number} ”{title}”',
  'threat-untitled': 'hot {number}',
  'subject-threat': 'Hot {number} ”{title}”',
  'subject-threat-untitled': 'Hot {number}',
  'subject-text': 'Text',
  'subject-text-named': 'Text ”{name}”',
  'subject-trust-boundary': 'Förtroendegräns',
  'subject-trust-boundary-named': 'Förtroendegräns ”{name}”',
  'subject-mitigation': 'Åtgärd ”{title}”',
  'subject-mitigation-titled-on': 'Åtgärd ”{title}” för {threat}',
  'subject-mitigation-on': 'Åtgärd för {threat}',
  'subject-mitigation-untitled': 'Åtgärd',
  'subject-assumption-on': 'Antagande för {threat}',
  'subject-assumption-on-model': 'Antagande för modellen',
  'subject-assumption': 'Antagande',
  'whole-threat': 'hela hotet',
  'whole-mitigation': 'hela åtgärden',
  'whole-assumption': 'hela antagandet',
  'split-into-copies': {
    one: 'en enda post, nu {count} kopia',
    other: 'en enda post, nu {count} kopior',
  },
  'note-name-dropped': 'dess namn',
  'scope-marking-dropped': 'dess markering utanför omfattningen',
  'threat-attachment-stray-text': 'dess koppling till texten',
  'threat-attachment-stray-text-named': 'dess koppling till texten ”{name}”',
  'threat-attachment-stray-trust-boundary':
    'dess koppling till förtroendegränsen',
  'threat-attachment-stray-trust-boundary-named':
    'dess koppling till förtroendegränsen ”{name}”',
  'threat-attachment-stray-unknown':
    'dess koppling till ett element som saknas',
  'threat-model-link-dropped': 'dess koppling till hela modellen',
  'threat-category-unnamed':
    'dess kategori, en egen kategori när filen öppnas igen',
  'mitigation-records-merged': {
    one: 'dess {count} åtgärd, nu en enda utan titel',
    other: 'dess {count} åtgärder, nu en enda utan titel',
  },
  'mitigation-title-merged': 'åtgärdens titel, nu en del av texten',
  'mitigation-status-dropped': '{status}, {inferred} när filen öppnas igen',
  'threat-status-unmapped': 'dess status ”{status}”',
  'threat-severity-unmapped': 'dess allvarlighetsgrad ”{severity}”',
  'threat-category-eop-suit': 'dess kort i Elevation of Privilege',
  'threat-category-unmapped':
    'dess kategori ”{category}”, läst som en egen kategori',
  'key-undeclared': 'Nyckel {path}: inte läst',
  'assumption-element-links-dropped': 'dess länkar till element',
  'otm-threat-split': 'kopierat för en annan förekomst',
  'otm-threat-status-unmapped':
    'dess status ”{status}”, läst som öppen och kvar i dess beskrivning',
  'otm-mitigation-split': 'kopierad för en annan förekomst',
  'otm-mitigation-status-retained':
    'dess status ”{status}”, läst som föreslagen och kvar i dess beskrivning',
  'otm-mitigation-unlinked':
    'Åtgärd ”{id}”: utan hot, nu en rad i modellens beskrivning',
  'otm-assets-as-descriptions':
    'Tillgångar: nu beskrivningar på flöden och komponenter, inte längre delade',
  'otm-components-as-processes':
    'Komponenttyper: nu processer, kvar i beskrivningarna',
  'tmbom-control-proposed':
    'dess status, läst som föreslagen och kvar i dess beskrivning',
  'tmbom-control-unlinked':
    'Kontroll ”{name}”: utan hot, nu en rad i modellens beskrivning',
  'tmbom-flow-fields-as-prose':
    'Flödenas kryptering och känslighet: nu beskrivningstext',
  'tmbom-data-set-as-prose':
    'Datamängd ”{name}”: nu text på dess datalager, inte längre delad',
  'tmbom-data-set-dropped': 'Datamängd ”{name}”: på inget datalager, inte läst',
  'field-not-retained': 'Fält {path}: inte läst',
});
