import { fixedNumber } from '@saerskriven/model';

const decimals = 3;

/**
 * One number as an SVG attribute carries it: the model's `fixedNumber` at
 * three decimals, with no locale, no exponent at any magnitude and no
 * negative zero, so one model gives the same bytes on every run and every
 * platform. A number that is not finite has no such writing and raises a
 * `RangeError`, which stops the drawing where an attribute would otherwise
 * read `Infinity` or `NaN`.
 */
export function svgNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(
      `An SVG number must be finite, and this one is ${String(value)}.`,
    );
  }
  return fixedNumber(value, decimals);
}
