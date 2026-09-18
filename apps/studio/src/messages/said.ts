import type { StudioTranslator } from './catalogues.js';

/** The part of a translator that resolves one message to text. */
export type Speaker = StudioTranslator['t'];

/**
 * Text worded when it is shown rather than when it is made, so a notice or an
 * announcement standing through a change of language reads in the new one.
 */
export type Said = (t: Speaker) => string;

/** Complete sentences as one text, leaving out any that are empty. */
export function sentences(...said: readonly string[]): string {
  return said.filter((sentence) => sentence !== '').join(' ');
}
