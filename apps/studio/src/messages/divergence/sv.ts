import { catalogue } from '@saerskriven/i18n';
import { divergenceMessages } from './contract.js';

export const divergenceSv = catalogue(divergenceMessages)('sv')({
  line: '{subject}: {detail} ({reason})',
  'subject-model': 'modellen',
  'subject-diagram': 'diagrammet ”{id}”',
  'subject-element': 'elementet ”{id}”',
  'subject-threat': 'hotet ”{id}”',
  'subject-mitigation': 'åtgärden ”{id}”',
  'subject-assumption': 'antagandet ”{id}”',
  'reason-unrepresentable': 'ingen plats i formatet',
  'reason-undeclared': 'inte deklarerat av filschemat',
  'reason-narrowed': 'nedkortat för att passa formatet',
  'reason-split': 'uppdelat av formatet',
  'reason-overridden': 'inte upprepat av kodeken',
  'reason-discarded-by-edit': 'borttaget av en ändring',
  'release-restamped':
    'utgåvan ”{from}” som källan skrevs av, till förmån för {written} som denna kodek skriver',
  'threat-mark-raised-by-issue':
    'hotens högvattenmärke {from}, höjt till {raised} för att täcka ett nummer denna skrivning delade ut',
  'threat-mark-raised-to-issued':
    'hotens högvattenmärke {from}, höjt till {raised}, det högsta numret modellen delat ut och som inget nummer i filen når',
  'diagram-mark-raised-by-issue':
    'diagrammens högvattenmärke {from}, höjt till {raised} för att täcka ett nummer denna skrivning delade ut',
  'diagram-mark-raised-to-issued':
    'diagrammens högvattenmärke {from}, höjt till {raised}, det högsta numret modellen delat ut och som inget nummer i filen når',
  'assumption-unrecorded': 'antagandet, som formatet inte för någon uppgift om',
  'diagram-discarded': 'diagrammet ”{title}” som källdokumentet innehöll',
  'threat-copy-detached':
    'kopian som källdokumentet lade under cellen ”{cell}”, som modellen inte längre knyter den till',
  'threat-discarded':
    'hotet ”{title}” som källdokumentet lade under en cell som modellen behöll',
  'note-name-dropped':
    'namnet ”{name}”, eftersom formatet har en enda text för en anteckning och inget namn vid sidan av',
  'scope-marking-dropped':
    'markeringen utanför omfattningen, som formatet bara noterar på de element ett hot knyts till',
  'cell-reshaped':
    'det källan bar på cellen {shape} med detta id, som nu ritar en {kind}',
  'diagram-name-numbered':
    'namnet, eftersom formatet numrerar ett diagram i stället för att namnge det, skrivet som {number}',
  'cell-discarded': 'cellen {shape} som källdokumentet innehöll',
  'threat-attachment-stray':
    'kopplingen till {kind} ”{element}”, eftersom formatet bara lägger ett hot under en aktör, en process, ett lager eller ett flöde',
  'threat-attachment-stray-unknown':
    'kopplingen till det okända ”{element}”, eftersom formatet bara lägger ett hot under en aktör, en process, ett lager eller ett flöde',
  'threat-unplaceable':
    'själva hotet, som formatet bara håller under en cell medan detta hot inte nämner någon att lägga det under',
  'threat-split-across-elements': {
    one: 'den enda posten, skriven en gång under det {count} element den nämner',
    other:
      'den enda posten, skriven en gång under vart och ett av de {count} element den nämner',
  },
  'threat-category-unnamed':
    '{methodology}-kategorin ”{category}”, som Threat Dragons egna etiketter inte namnger',
  'mitigation-records-merged': {
    one: 'den {count} post som slagits samman till dess enda åtgärdstext, vilken läses tillbaka som en enda post utan titel',
    other:
      'de {count} poster som slagits samman till dess enda åtgärdstext, vilken läses tillbaka som en enda post utan titel',
  },
  'mitigation-title-merged':
    'åtgärdens titel som skrivits in i dess enda åtgärdstext, vilken läses tillbaka som en enda post utan titel',
  'mitigation-empty-dropped':
    'åtgärden utan titel och utan text, som inte skriver något i texten för hotet ”{threat}”',
  'mitigation-status-dropped':
    'statusen ”{status}” i texten för hotet ”{threat}”, som läses tillbaka som ”{inferred}”',
  'mitigation-unlinked':
    'åtgärden ”{name}”, som inte är kopplad till något hot formatet håller',
  'mitigation-split-across-threats': {
    one: 'den enda posten, skriven in i åtgärdstexten för det {count} hot den är kopplad till',
    other:
      'den enda posten, skriven in i åtgärdstexten för vart och ett av de {count} hot den är kopplad till',
  },
  'threat-status-unmapped':
    'statusen ”{status}”, som modellen inte har något tillstånd för',
  'threat-severity-unmapped':
    'allvarsgraden ”{severity}”, som modellen inte har någon nivå för',
  'threat-category-eop-suit':
    'kortet Elevation of Privilege, av vilket modellen bara håller färgen',
  'threat-category-unmapped':
    'kategorin ”{category}”, som inget av Threat Dragons språk namnger',
  'key-undeclared': 'nyckeln {path}',
  'assumption-element-links-dropped':
    'dess länkar till element, som ett antagande inte håller',
  'otm-threat-split': 'Hotet ”{id}” blir separata poster för sina förekomster.',
  'otm-threat-undecided':
    'Hotet ”{id}” importeras med obestämd allvarsgrad och en ospecificerad kategori.',
  'otm-threat-status-unmapped':
    'Hotstatusen ”{status}” importeras som öppen. Den angivna statustexten stannar i beskrivningen.',
  'otm-threat-status-absent':
    'En saknad hotstatus importeras som öppen. Den angivna statustexten stannar i beskrivningen.',
  'otm-mitigation-split':
    'Åtgärden ”{id}” blir separata poster för sina förekomster.',
  'otm-mitigation-status-retained':
    'Åtgärden ”{id}” har källstatusen ”{status}”, som behålls i dess beskrivning och importeras som föreslagen.',
  'otm-mitigation-status-absent':
    'Åtgärden ”{id}” har ingen källstatus och importeras som föreslagen.',
  'otm-mitigation-unlinked':
    'Åtgärden ”{id}” nämner inget hot och blir en rad i modellens beskrivning.',
  'otm-assets-as-descriptions':
    'Namnen på refererade tillgångar blir beskrivningar på flöden och komponenter. Delad dataidentitet behålls inte.',
  'otm-components-as-processes':
    'OTM-komponenttyper blir processnoder. Deras ursprungliga typer stannar i beskrivningarna.',
  'otm-geometry-generated':
    'Elementet ”{id}” får genererad geometri där källan saknar sådan.',
  'tmbom-threats-undecided':
    'Hot importeras som öppna med obestämd allvarsgrad och en ospecificerad kategori. Separata riskbedömningar omvandlas inte till hotens allvarsgrad.',
  'tmbom-control-proposed':
    'Kontrollen ”{name}” importeras som föreslagen. Dess ursprungliga status stannar i beskrivningen.',
  'tmbom-control-unlinked':
    'Kontrollen ”{name}” nämner inget hot och blir en rad i modellens beskrivning.',
  'tmbom-geometry-generated':
    'Diagrammet får genererad geometri grupperad efter källans tillitszon. Tillhörigheten blir visuell.',
  'tmbom-flow-fields-as-prose':
    'Flödenas fält för kryptering och känslighet stannar som löptext i flödesbeskrivningarna.',
  'tmbom-data-set-as-prose':
    'Datamängden ”{name}” blir löptext på sina lager. Delad dataidentitet behålls inte.',
  'tmbom-data-set-dropped':
    'Datamängden ”{name}” har ingen placering på ett lager och behålls inte.',
  'field-not-retained': 'Källfältet {path} behålls inte vid import.',
});
