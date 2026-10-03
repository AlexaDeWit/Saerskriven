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

/**
 * The count that stores every number of a typed form as it was typed: the
 * most decimals any of `typed` is written with.
 */
export function typedDecimals(typed: readonly number[]): Decimals {
  return Math.max(0, ...typed.map(decimalsOf));
}
