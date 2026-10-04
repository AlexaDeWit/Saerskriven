import { z } from 'zod';
import type { Point, Size } from './geometry.js';

const mostDecimals = 100;

/**
 * Decimal count accepted by `toFixed`. An omitted count leaves computed
 * values unchanged.
 */
export const decimalsSchema = z.number().int().min(0).max(mostDecimals);

/** Count of decimals to store. */
export type Decimals = z.infer<typeof decimalsSchema>;

/**
 * Decimal count in a number's written mantissa and exponent, capped at the
 * hundred {@link decimalsSchema} allows.
 */
export function decimalsOf(value: number): Decimals {
  const [mantissa, exponent = '0'] = String(value).split('e');
  const written = mantissa.split('.').at(1)?.length ?? 0;
  return counted(written - Number(exponent));
}

/**
 * Writes at most `decimals` places without locale, exponent, trailing zeros
 * or negative zero. The count is clamped to {@link decimalsSchema}.
 * Non-finite values produce `Infinity`, `-Infinity` or `NaN`, so callers
 * requiring finite output must validate first.
 */
export function fixedNumber(value: number, decimals: Decimals): string {
  const fixed = value.toFixed(counted(decimals));
  const plain = fixed.includes('e')
    ? expanded(value)
    : withoutTrailingZeros(fixed);
  return plain === '-0' ? '0' : plain;
}

/**
 * Rounds to `decimals` places without negative zero, or returns `value` when
 * the count is omitted. Rounding preserves whole numbers, so values within
 * the integer bounds of `geometryLimits` stay within them.
 */
export function storedNumber(
  value: number,
  decimals: Decimals | undefined,
): number {
  return decimals === undefined ? value : Number(fixedNumber(value, decimals));
}

/** A copy of `point` with each coordinate as {@link storedNumber} stores it. */
export function storedPoint(
  point: Point,
  decimals: Decimals | undefined,
): Point {
  return {
    x: storedNumber(point.x, decimals),
    y: storedNumber(point.y, decimals),
  };
}

/** A copy of each of `points` as {@link storedPoint} stores it. */
export function storedPoints(
  points: readonly Point[],
  decimals: Decimals | undefined,
): Point[] {
  return points.map((point) => storedPoint(point, decimals));
}

/** A copy of `size` with each extent as {@link storedNumber} stores it. */
export function storedSize(size: Size, decimals: Decimals | undefined): Size {
  return {
    width: storedNumber(size.width, decimals),
    height: storedNumber(size.height, decimals),
  };
}

function counted(decimals: Decimals): number {
  const whole = Math.trunc(decimals);
  return whole >= 0 ? Math.min(whole, mostDecimals) : 0;
}

function withoutTrailingZeros(fixed: string): string {
  const [whole, fraction = ''] = fixed.split('.');
  const kept = fraction.replace(/0+$/u, '');
  return kept === '' ? whole : `${whole}.${kept}`;
}

function expanded(value: number): string {
  const [mantissa, exponent] = value.toExponential().split('e');
  const sign = mantissa.startsWith('-') ? '-' : '';
  const digits = mantissa.replace('-', '').replace('.', '');
  const zeros = Math.max(0, Number(exponent) - digits.length + 1);
  return `${sign}${digits}${'0'.repeat(zeros)}`;
}
