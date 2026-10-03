const markers = {
  recordRow: 'data-record-row',
  threatItem: 'data-threat-item',
} as const;

/**
 * The element under `root` whose `data-` marker of `key` holds `id`. The id
 * is compared as the element stores it, so no selector is built from data.
 */
export function markedWithin(
  root: ParentNode | null | undefined,
  key: keyof typeof markers,
  id: string,
): HTMLElement | undefined {
  return [
    ...(root?.querySelectorAll<HTMLElement>(`[${markers[key]}]`) ?? []),
  ].find((element) => element.dataset[key] === id);
}
