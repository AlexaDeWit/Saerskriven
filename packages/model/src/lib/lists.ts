/** The items of `items` in the opposite order, as a new list. */
export function reversed<Item>(items: readonly Item[]): Item[] {
  return items.map((_item, index) => items[items.length - 1 - index]);
}

/** Whether two lists hold the same items in the same order, by `same`. */
export function sameItems<Item>(
  left: readonly Item[],
  right: readonly Item[],
  same: (left: Item, right: Item) => boolean = (a, b) => a === b,
): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => same(item, right[index]))
  );
}
