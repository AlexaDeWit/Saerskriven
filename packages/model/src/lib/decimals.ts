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
 * How many decimals a number is written with, an exponent counted in, so
 * 1.5e-7 has eight and 1e21 has none, up to the hundred {@link decimalsSchema}
 * allows. A number stored at that count is the number itself, unless it has
 * more than a hundred decimals, as 5e-324 does.
 */
export function decimalsOf(value: number): Decimals {
  const [mantissa, exponent = '0'] = String(value).split('e');
  const written = mantissa.split('.').at(1)?.length ?? 0;
  return counted(written - Number(exponent));
}

/**
 * One number written at `decimals` decimals or fewer: fixed precision, no
 * locale, no exponent at any magnitude, no trailing zero and no negative zero.
 * The model's coordinates are bare numbers and `toFixed` turns exponential
 * from 1e21 up, so a magnitude that far out has its digits written out
 * instead. A count outside {@link decimalsSchema} is held to its range, so no
 * count throws. A number that is not finite is written as `Infinity`,
 * `-Infinity` or `NaN`, which {@link storedNumber} reads back as the number
 * itself, so a caller that must have a plain number refuses one first.
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
 * negative zero. Where the caller names none, it is `value` itself. Every
 * count writes a whole number as it is, and both ends of `geometryLimits` are
 * whole, so a coordinate or an extent inside them is stored inside them.
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
