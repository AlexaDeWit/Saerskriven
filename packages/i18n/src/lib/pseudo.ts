import type { Catalogues } from './catalogue.js';
import type { Sections } from './contract.js';
import { defaultLocale } from './locales.js';
import { literalsShaped, type DotFree, type Translator } from './translator.js';

/** The characters a pseudo-localized literal opens and closes with. */
export const pseudoMarkers = { open: '⟦', close: '⟧' } as const;

const accented: Readonly<Record<string, string>> = {
  a: 'á',
  c: 'ç',
  e: 'é',
  i: 'ï',
  n: 'ñ',
  o: 'ö',
  u: 'ü',
  y: 'ý',
  A: 'Å',
  C: 'Ç',
  E: 'É',
  I: 'Ï',
  N: 'Ñ',
  O: 'Ö',
  U: 'Ü',
  Y: 'Ý',
};

const expansion = 0.4;

/**
 * `literal` accented, lengthened by two fifths, and set between
 * {@link pseudoMarkers}. An empty literal stays empty.
 */
export function pseudoText(literal: string): string {
  if (literal === '') {
    return '';
  }
  const letters = literal.replaceAll(
    /[aceinouyACEINOUY]/gu,
    (letter) => accented[letter] ?? letter,
  );
  const padding = '·'.repeat(Math.ceil(literal.length * expansion));
  return `${pseudoMarkers.open}${letters}${padding}${pseudoMarkers.close}`;
}

/**
 * A development translator that reads the en-CA catalogues through
 * {@link pseudoText}. Every literal run of a template is marked and
 * lengthened, and a parameter value passes through unmarked, so text shown
 * without the markers either came from outside the catalogues or is data.
 */
export function pseudoTranslator<S extends Sections>(
  sections: S & DotFree<S>,
  catalogues: Catalogues<S>,
): Translator<S> {
  return literalsShaped(sections, catalogues, defaultLocale, pseudoText);
}
