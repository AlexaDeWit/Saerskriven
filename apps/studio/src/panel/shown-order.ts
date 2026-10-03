import { useState } from 'react';

/**
 * `rows` in the order of the ids a list has shown, and that order with the
 * ids of rows it has not shown before appended. A shown id whose row is gone
 * keeps its slot, so the row takes it back when it returns. The order comes
 * back as `shown` itself when no row is new.
 */
export function inShownOrder<Row extends { readonly id: string }>(
  rows: readonly Row[],
  shown: readonly string[],
): { readonly rows: readonly Row[]; readonly shown: readonly string[] } {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const known = new Set(shown);
  const arrived = [...byId.keys()].filter((id) => !known.has(id));
  const order =
    arrived.length === 0 && known.size === shown.length
      ? shown
      : [...known, ...arrived];
  return {
    rows: order.flatMap((id) => byId.get(id) ?? []),
    shown: order,
  };
}

/**
 * `rows` in the order the first render gave them, held while the component
 * stays mounted. A row arriving later joins the end, and a row that goes and
 * comes back takes its old slot ({@link inShownOrder}).
 */
export function useShownOrder<Row extends { readonly id: string }>(
  rows: readonly Row[],
): readonly Row[] {
  const [order, setOrder] = useState<readonly string[]>(() =>
    rows.map(({ id }) => id),
  );
  const arranged = inShownOrder(rows, order);
  if (arranged.shown !== order) {
    setOrder(arranged.shown);
  }
  return arranged.rows;
}
