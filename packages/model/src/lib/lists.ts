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
