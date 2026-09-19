import { catalogue } from '@saerskriven/i18n';
import { noticeMessages } from './contract.js';

export const noticeSv = catalogue(noticeMessages)('sv')({
  problems: 'Problem',
  dismiss: 'Dölj problemet',
  'refusal-details': {
    one: '{count} detalj om avvisningen',
    other: '{count} detaljer om avvisningen',
  },
  'operation-refused': 'Modellen avvisade ändringen.',
  'file-unreachable': 'Saerskriven kunde inte nå filen.',
  'recovery-rejected':
    'Saerskriven avvisade den sparade återställningsögonblicksbilden.',
  'recovery-unavailable': 'Lokal återställning är inte tillgänglig.',
  'no-format-claimed': 'Inget format kände igen {name}.',
  'formats-tried': 'Saerskriven försökte med {formats}.',
  'read-limit': '{name} överskrider en läsgräns, så inget läste den.',
  'read-limit-detail': '{limit}: gränsen är {bound}, filen nådde {observed}.',
  'malformed-text': '{name} är inte giltig text i formatet som kände igen den.',
  'invalid-document':
    '{name} är inte ett giltigt dokument i formatet som kände igen den.',
  'invalid-model':
    '{name} är ett giltigt dokument, men modellen det ger är inte giltig.',
  'snapshot-limit-detail':
    '{limit}: gränsen är {bound}, ögonblicksbilden nådde {observed}.',
  'snapshot-unsupported':
    'Den sparade ögonblicksbilden är felformad eller stöds inte.',
  'snapshot-invalid': 'Den sparade ögonblicksbilden är inte giltig.',
  'snapshot-model-invalid': 'Den sparade modellen är inte giltig.',
  'snapshot-earlier-release':
    'En tidigare version av Saerskriven sparade den här sessionen, i en form som den här versionen inte kan återställa.',
  'snapshot-release':
    'Saerskriven {release} sparade den här sessionen, i en form som den här versionen inte kan återställa.',
  'field-not-saved': '{field} sparades inte.',
  'refused-character': 'Modellen godtar inte tecknet på position {position}.',
  'empty-name': 'Ett namn kan inte vara tomt.',
  'op-element-properties': 'Objektets egenskaper avvisades.',
  'op-element-relationships': 'Objektet har ogiltiga gränsrelationer.',
  'op-fragment': 'Den kopierade grafen avvisades.',
  'op-unknown-diagram': 'Modellen innehåller inget diagram {id}.',
  'op-duplicate-diagram': 'Modellen innehåller redan ett diagram {id}.',
  'op-empty-title': 'Diagram {id} kan inte lämnas utan titel.',
  'op-title-character':
    'Titeln på diagram {id} innehåller ett tecken som modellen inte godtar.',
  'op-diagram-not-empty': {
    one: 'Diagram {id} kan inte tas bort medan det innehåller objekt, och det innehåller {count}.',
    other:
      'Diagram {id} kan inte tas bort medan det innehåller objekt, och det innehåller {count}.',
  },
  'op-unknown-element': 'Modellen innehåller inget objekt {id}.',
  'op-unknown-threat': 'Modellen innehåller inget hot {id}.',
  'op-unknown-mitigation': 'Modellen innehåller ingen åtgärd {id}.',
  'op-unknown-assumption': 'Modellen innehåller inget antagande {id}.',
  'op-duplicate-element': 'Modellen innehåller redan ett objekt {id}.',
  'op-duplicate-threat': 'Modellen innehåller redan ett hot {id}.',
  'op-duplicate-mitigation': 'Modellen innehåller redan en åtgärd {id}.',
  'op-duplicate-assumption': 'Modellen innehåller redan ett antagande {id}.',
  'op-mitigation-without-threat':
    'Åtgärden {id} är inte länkad till något hot, och en åtgärd läggs till på ett hot.',
  'op-assumption-without-threat':
    'Antagandet {id} är inte länkat till något hot, och ett antagande läggs till på ett hot.',
  'op-assumption-without-reference':
    'Antagandet {id} är inte länkat till något hot och gäller inte modellen.',
  'op-reused-number': 'Hotnummer {number} har redan delats ut.',
  'op-changed-number':
    'Hot {id} kan inte få nummer {number}, eftersom ett nummer bara delas ut en gång.',
  'op-source-endpoint': 'Flödets källa anger {id}, som inte kan vara en källa.',
  'op-target-endpoint': 'Flödets mål anger {id}, som inte kan vara ett mål.',
  'op-not-resizable': 'Objekt {id} har ingen storlek att ange.',
  'op-not-note': 'Objekt {id} är inte en anteckning på arbetsytan.',
  'op-not-flow': 'Objekt {id} är inte ett flöde.',
  'op-empty-name': 'Objekt {id} kan inte lämnas utan namn.',
  'op-element-character':
    'Texten för objekt {id} innehåller ett tecken som modellen inte godtar.',
  'op-model-title-character':
    'Modellens titel innehåller ett tecken som modellen inte godtar.',
  'op-model-owner-character':
    'Modellens ägare innehåller ett tecken som modellen inte godtar.',
  'op-model-description-character':
    'Modellens beskrivning innehåller ett tecken som modellen inte godtar.',
  'op-contributor-character':
    'Post {entry} bland bidragsgivarna innehåller ett tecken som modellen inte godtar.',
});
