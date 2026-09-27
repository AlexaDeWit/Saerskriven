import { translator, type Locale } from '@saerskriven/i18n';
import {
  studioCatalogues,
  studioMessages,
  type StudioTranslator,
} from './catalogues.js';

/** The studio's `t` in `locale`, whatever locale is active. */
export const inLocale = (locale: Locale): StudioTranslator['t'] =>
  translator(studioMessages, studioCatalogues, locale).t;
