import { text } from '@saerskriven/i18n';

/**
 * The labels of the stored values only the studio shows, so no value is shown
 * raw. A value an export also shows takes render's term instead.
 */
export const enumMessages = {
  'the-actor': text(),
  'the-process': text(),
  'the-store': text(),
  'the-text': text(),
  'the-flow': text(),
  'the-trust-boundary': text(),
  'kind-actor': text(),
  'kind-process': text(),
  'kind-store': text(),
  'kind-text': text(),
  'kind-flow': text(),
  'kind-trust-boundary': text(),
  mitigation: text(),
  assumption: text(),
  'noun-mitigation': text(),
  'noun-assumption': text(),
  'not-recorded': text(),
  recorded: text(),
  yes: text(),
  no: text(),
  'colour-system': text(),
  'colour-light': text(),
  'colour-dark': text(),
  'side-top': text(),
  'side-right': text(),
  'side-bottom': text(),
  'side-left': text(),
} as const;
