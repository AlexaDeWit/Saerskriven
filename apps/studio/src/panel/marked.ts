/** The selector of each element the panel marks with an id: a record row and a threat item. */
export const marked = {
  recordRow: '[data-record-row]',
  threatItem: '[data-threat-item]',
} as const;

/**
 * The element under `root` whose marker of `key` holds `id`. The id is
 * compared as the element stores it, so no selector is built from data.
 */
export function markedWithin(
  root: ParentNode | null | undefined,
  key: keyof typeof marked,
  id: string,
): HTMLElement | undefined {
  return [...(root?.querySelectorAll<HTMLElement>(marked[key]) ?? [])].find(
    (element) => element.dataset[key] === id,
  );
}
