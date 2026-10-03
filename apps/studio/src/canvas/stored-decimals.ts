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

/** The most decimals a form stores of any number: Position and size, and the flow end form. */
export const mostTypedDecimals: Decimals = 6;

/**
 * How many decimals the Position and size form stores when it shows `shown`
 * in its fields: the most any of them is written with, never fewer than
 * {@link commandDecimals} and never more than {@link mostTypedDecimals}. So a
 * typed number of six decimals or fewer is stored as typed, a field showing a
 * longer number is stored at six, and what the form writes without showing it
 * (the elements a typed group position moves, the points of a trust boundary
 * curve) keeps at least three.
 */
export function typedDecimals(shown: readonly number[]): Decimals {
  return Math.min(
    mostTypedDecimals,
    Math.max(commandDecimals, ...shown.map(decimalsOf)),
  );
}
