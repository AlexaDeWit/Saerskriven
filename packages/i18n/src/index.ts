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
  catalogueTemplates,
  type Catalogue,
  type CatalogueTemplate,
  type Catalogues,
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
export { negotiate } from './lib/negotiate.js';
