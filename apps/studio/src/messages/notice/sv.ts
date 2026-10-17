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
  'recent-file-gone': 'Saerskriven hittade inte {name}.',
  'recent-file-dropped': 'Filen togs bort från Senaste filer.',
  'recovery-rejected':
    'Saerskriven avvisade den sparade återställningsögonblicksbilden.',
  'recovery-unavailable': 'Lokal återställning är inte tillgänglig.',
  'recovery-not-restored':
    'Saerskriven återställde inte den senaste sessionen.',
  'no-format-claimed': 'Inget format kände igen {name}.',
  'formats-tried': 'Saerskriven försökte med {formats}.',
  'read-limit': '{name} överskrider en läsgräns, så inget läste den.',
  'read-limit-detail': '{limit}: gränsen är {bound}, filen nådde {observed}.',
  'malformed-text': '{name} är inte giltig text i formatet som kände igen den.',
  'later-format-version':
    '{name} kommer från en senare version av Saerskriven.',
  'later-format-version-detail':
    'Den är Saerskriven YAML version {stated}, och den här versionen av Saerskriven läser formatets versioner {first} till {last}. Öppna den i en senare version.',
  'invalid-document':
    '{name} är inte ett giltigt dokument i formatet som kände igen den.',
  'invalid-model':
    '{name} är ett giltigt dokument, men modellen det ger är inte giltig.',
  'link-refused': 'Saerskriven kunde inte öppna den delade länken.',
  'link-too-long':
    'Länken är {length} tecken lång, över de {limit} som en länk får rymma.',
  'link-past-read-bound':
    'Modellen är {size} byte som text, över de {bound} som en läsning godtar.',
  'link-not-a-link': 'Adressen innehåller ingen delad länk.',
  'link-encoding':
    'Länken använder kodning {prefix}, som den här versionen av Saerskriven inte läser. En senare version skrev den.',
  'link-cut-off':
    'Länken är avkortad eller skadad, så den rymmer ingen hel modell.',
  'link-module': 'Modulen som skriver och läser länkar kördes inte.',
  'link-too-large': 'Modellen som länken rymmer överskrider en läsgräns.',
  'link-not-a-model': 'Länken rymmer ingen modell som Saerskriven kan läsa.',
  'snapshot-limit-detail':
    '{limit}: gränsen är {bound}, ögonblicksbilden nådde {observed}.',
  'snapshot-unsupported':
    'Den sparade ögonblicksbilden är felformad eller stöds inte.',
  'snapshot-earlier-release':
    'En tidigare version av Saerskriven sparade den här sessionen, i en form som den här versionen inte kan återställa.',
  'snapshot-release':
    'Saerskriven {release} sparade den här sessionen, i en form som den här versionen inte kan återställa.',
  'snapshot-restore-unfinished':
    'Sessionen kunde inte visas. En omladdning gör ett nytt försök.',
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
  'op-not-on-diagram': 'Diagrammet {diagram} ritar inte objektet {id}.',
  'op-already-on-diagram': 'Diagrammet {diagram} ritar redan objektet {id}.',
  'op-last-placement':
    'Diagrammet {diagram} är det sista som ritar objektet {id}. Ta bort det ur modellen i stället.',
  'op-invalid-placement':
    'Objektet {id} kan inte ritas i diagrammet {diagram} med den geometrin.',
  'op-several-diagrams':
    'Objektet {id} finns i mer än ett diagram: {diagrams}.',
  'op-merge-itself': 'Objektet {id} kan inte slås samman med sig självt.',
  'op-merge-kinds':
    'Objekten {id} och {into} är av olika slag: {kind} och {intoKind}. Bara objekt av samma slag kan slås samman.',
  'op-merge-joined':
    'Flödet {flow} förbinder objekten {id} och {into}, så de kan inte slås samman.',
  'op-merge-flow-ends':
    'Flödena {id} och {into} förbinder inte samma objekt i samma riktning, så de kan inte slås samman.',
  'op-source-not-away':
    'Källan till flödet {id} är inte ritad på avstånd från sitt objekt i diagrammet {diagram}.',
  'op-target-not-away':
    'Målet för flödet {id} är inte ritat på avstånd från sitt objekt i diagrammet {diagram}.',
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
  'op-not-trust-boundary': 'Objekt {id} är inte en förtroendegräns.',
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
