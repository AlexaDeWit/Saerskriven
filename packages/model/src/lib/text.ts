import { z } from 'zod';
import { refusedCharacterDetail } from './parse-issue.js';

const acceptedClass =
  '\\p{L}\\p{M}\\p{N}\\p{P}\\p{S}\\p{Zs}\\t\\n\\r' +
  '[\\p{Cf}--[\\p{Script=Common}\\p{Script=Inherited}]]' +
  '\\u200C\\u200D\\u0605\\u06DD\\u08E2';

const refusedCharacter = new RegExp(`[^${acceptedClass}]`, 'v');

/**
 * Whether every character of `text` is one the model accepts. The rule is a
 * search for one refused character rather than an anchored match of the whole
 * string, which exhausts the regex engine's backtracking stack on a text the
 * size `readLimits` admits. The pattern is built with the constructor because
 * its set difference needs the `v` flag, which the TypeScript target does not
 * accept on a literal.
 */
export function acceptsEveryCharacter(text: string): boolean {
  return !refusedCharacter.test(text);
}

/**
 * One string of the model, the empty string included: an allowlist of the
 * letters, marks, numbers, punctuation, symbols and space separators Unicode
 * defines, tab, line feed and carriage return, and the format characters a
 * script owns. [`SCHEMA.md`](../../SCHEMA.md) states the set in full, and
 * `text.format-characters.snapshot.txt` pins which format characters the
 * runtime's Unicode data admits. The refusal names its own parse issue code,
 * since a reader phrases the refusal rather than reading a message.
 */
export const acceptedTextSchema = z
  .string()
  .refine(acceptsEveryCharacter, { params: refusedCharacterDetail });

/**
 * Whether `text` is a name with nothing in it. A name of only spaces, tabs or
 * line breaks counts: the schema accepts it, and a reader sees no name.
 */
export function isEmptyName(text: string): boolean {
  return text.trim() === '';
}

/**
 * Where the first character {@link acceptedTextSchema} refuses sits, as an
 * index in UTF-16 code units, or undefined for text it accepts whole.
 */
export function firstRefusedCharacter(text: string): number | undefined {
  const found = refusedCharacter.exec(text);
  return found === null ? undefined : found.index;
}
