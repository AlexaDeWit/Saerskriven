import { z } from 'zod';
import type { Point, Size } from './geometry.js';

const mostDecimals = 100;

/**
 * How many decimals a geometry operation stores of each number it writes: a
 * whole count from 0 to 100, the range `toFixed` takes. An operation handed
 * no count stores what it computes.
 */
export const decimalsSchema = z.number().int().min(0).max(mostDecimals);

/** Count of decimals to store. */
export type Decimals = z.infer<typeof decimalsSchema>;

/**
 * One number written at `decimals` decimals or fewer: fixed precision, no
 * locale, no exponent at any magnitude, no trailing zero and no negative zero.
 * The model's coordinates are bare numbers and `toFixed` turns exponential
 * from 1e21 up, so a magnitude that far out has its digits written out
 * instead. A count outside {@link decimalsSchema} is held to its range, so no
 * count throws.
 */
export function fixedNumber(value: number, decimals: Decimals): string {
  const fixed = value.toFixed(counted(decimals));
  const plain = fixed.includes('e')
    ? expanded(value)
    : withoutTrailingZeros(fixed);
  return plain === '-0' ? '0' : plain;
}

/**
 * `value` as a geometry operation stores it. Where the caller names a count,
 * that is the nearest number of `decimals` decimals or fewer, which reads
 * back without the noise of the arithmetic that made `value` and is never
 * negative zero. Where the caller names none, it is `value` itself.
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

/**
 * A copy of `size` with each extent as {@link storedNumber} stores it. An
 * extent that a count would round to zero becomes the smallest one that count
 * can write, 0.1 at one decimal and 1 at none, so a stored size stays
 * positive.
 */
export function storedSize(size: Size, decimals: Decimals | undefined): Size {
  return {
    width: storedExtent(size.width, decimals),
    height: storedExtent(size.height, decimals),
  };
}

function storedExtent(extent: number, decimals: Decimals | undefined): number {
  return decimals === undefined
    ? extent
    : Math.max(storedNumber(extent, decimals), 1 / 10 ** counted(decimals));
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
