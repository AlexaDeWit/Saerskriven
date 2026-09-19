export {
  defaultLocale,
  locales,
  pluralCategories,
  type Locale,
  type PluralCategory,
} from './lib/locales.js';
export {
  plural,
  text,
  type Contract,
  type MessageSpec,
  type ParameterKind,
  type ParameterShape,
  type PluralMessage,
  type Sections,
  type TextMessage,
} from './lib/contract.js';
export {
  templateParts,
  wellFormedTemplate,
  type MalformedTemplate,
  type Placeholders,
} from './lib/template.js';
export {
  catalogue,
  catalogueReport,
  catalogueTemplates,
  sameAsDefault,
  type Catalogue,
  type CatalogueReport,
  type CatalogueTemplate,
  type Catalogues,
  type DeclaredCatalogue,
  type ParameterName,
} from './lib/catalogue.js';
export {
  translator,
  type MessageArguments,
  type MessageId,
  type MessageOf,
  type ParameterValues,
  type TextMessageId,
  type Translator,
} from './lib/translator.js';
export { negotiate, supportedLocale } from './lib/negotiate.js';
export { pseudoMarkers, pseudoText, pseudoTranslator } from './lib/pseudo.js';
