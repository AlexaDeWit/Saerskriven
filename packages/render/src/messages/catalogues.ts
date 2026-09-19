import {
  translator,
  type Catalogue,
  type Catalogues,
  type Locale,
  type Translator,
} from '@saerskriven/i18n';
import { registerMessages } from './register/contract.js';
import { registerEnCA } from './register/en-CA.js';
import { registerFrCA } from './register/fr-CA.js';
import { registerSv } from './register/sv.js';
import { termMessages } from './terms/contract.js';
import { termsEnCA } from './terms/en-CA.js';
import { termsFrCA } from './terms/fr-CA.js';
import { termsSv } from './terms/sv.js';
import { warningMessages } from './warning/contract.js';
import { warningEnCA } from './warning/en-CA.js';
import { warningFrCA } from './warning/fr-CA.js';
import { warningSv } from './warning/sv.js';

/** The export's message contract, one section per surface. */
export const exportMessages = {
  terms: termMessages,
  register: registerMessages,
  warning: warningMessages,
} as const;

type ExportMessages = typeof exportMessages;

/** Every locale's export catalogues. */
export const exportCatalogues: Catalogues<ExportMessages> = {
  'en-CA': { terms: termsEnCA, register: registerEnCA, warning: warningEnCA },
  'fr-CA': { terms: termsFrCA, register: registerFrCA, warning: warningFrCA },
  sv: { terms: termsSv, register: registerSv, warning: warningSv },
};

/**
 * The terms section's catalogue in each locale, for an app that joins
 * {@link termMessages} to its own sections instead of keeping a second copy.
 */
export const termCatalogues: {
  readonly [L in Locale]: Catalogue<L, typeof termMessages>;
} = {
  'en-CA': termsEnCA,
  'fr-CA': termsFrCA,
  sv: termsSv,
};

/** The export's messages resolved in one locale. */
export type ExportText = Translator<ExportMessages>;

const translators: { readonly [L in Locale]: ExportText } = {
  'en-CA': translator(exportMessages, exportCatalogues, 'en-CA'),
  'fr-CA': translator(exportMessages, exportCatalogues, 'fr-CA'),
  sv: translator(exportMessages, exportCatalogues, 'sv'),
};

/** The export's messages in `locale`. */
export function exportText(locale: Locale): ExportText {
  return translators[locale];
}
