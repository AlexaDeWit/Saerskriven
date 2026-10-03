import type { GestureInput } from '@saerskriven/canvas';
import { decimalsOf, type Decimals } from '@saerskriven/model';

/**
 * How many decimals an edit stores, by what made the gesture behind it: three
 * for a pointer (a mouse, a pen or a touch), which places finely, and one for
 * the keyboard, which moves in whole steps and is read out by a screen reader.
 */
export const gestureDecimals = {
  pointer: 3,
  keyboard: 1,
} as const satisfies Record<GestureInput, Decimals>;

/**
 * How many decimals an edit stores when a command works its geometry out,
 * however the command was invoked: Align, Distribute, Duplicate, Paste, Add
 * point, Switch boundary shape, and the flow end a removal frees.
 */
export const commandDecimals: Decimals = 3;

/** The Position and size form stores at most this many decimals of any number. */
export const mostTypedDecimals: Decimals = 6;

/**
 * How many decimals the Position and size form stores when it shows `shown`
 * in its fields: the most any of them is written with, never fewer than
 * {@link commandDecimals} and never more than {@link mostTypedDecimals}. A
 * typed number of six decimals or fewer is so stored as typed, an element a
 * typed group position moves keeps at least three decimals, and a field
 * showing a longer number is stored at six.
 */
export function typedDecimals(shown: readonly number[]): Decimals {
  return Math.min(
    mostTypedDecimals,
    Math.max(commandDecimals, ...shown.map(decimalsOf)),
  );
}
