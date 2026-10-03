import { fixedNumber } from '@saerskriven/model';

const decimals = 3;

/**
 * One number as an SVG attribute carries it: the model's `fixedNumber` at
 * three decimals, with no locale, no exponent at any magnitude and no
 * negative zero, so one model gives the same bytes on every run and every
 * platform.
 */
export function svgNumber(value: number): string {
  return fixedNumber(value, decimals);
}
