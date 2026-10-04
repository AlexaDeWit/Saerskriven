import { fixedNumber } from '@saerskriven/model';

const decimals = 3;

/**
 * Writes an SVG number at three decimals with {@link fixedNumber}.
 * Throws `RangeError` for non-finite values from unchecked live gestures.
 */
export function svgNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(
      `An SVG number must be finite, and this one is ${String(value)}.`,
    );
  }
  return fixedNumber(value, decimals);
}
