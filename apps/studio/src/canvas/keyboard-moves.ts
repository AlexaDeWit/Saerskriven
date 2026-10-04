import { handlerSlot } from '../ui/handler-slot.js';

/**
 * What a key press moved or resized: the item that holds focus, or the bend
 * being placed from the route toolbar, by its place among the flow's bends,
 * which is the one move made while something else holds focus.
 */
export type KeyboardMove = 'focused' | { readonly placedBend: number };

const follower = handlerSlot<(moved: KeyboardMove) => void>();

/**
 * Lends the handler `keyboardMoved` calls, and answers the function that takes
 * it back.
 */
export function followKeyboardMoves(
  moved: (item: KeyboardMove) => void,
): () => void {
  return follower.register(moved);
}

/**
 * Tells the handler lent through `followKeyboardMoves` that a key press has
 * just moved or resized something on the canvas: the selection, a bend, a
 * free flow end or a curve point by an arrow key, an element by an arrow key
 * on a resize control, or the bend being placed. The caller is what knows the
 * input, so a move or resize a pointer made never calls.
 */
export function keyboardMoved(moved: KeyboardMove = 'focused'): void {
  follower.current()?.(moved);
}
