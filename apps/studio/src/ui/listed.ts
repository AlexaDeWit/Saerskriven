/**
 * `items` as the locale writes a list of them, "A, B and C": each item in
 * its place and the words between them as text, for a list whose items a
 * caller draws as controls.
 */
export function listed<Item extends { readonly label: string }>(
  items: readonly Item[],
  locale: string,
): readonly (Item | string)[] {
  const waiting = [...items];
  return new Intl.ListFormat(locale, { type: 'conjunction' })
    .formatToParts(items.map(({ label }) => label))
    .map((part) =>
      part.type === 'element' ? (waiting.shift() ?? part.value) : part.value,
    );
}
