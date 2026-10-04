import {
  elementsById,
  type Diagram,
  type ElementId,
  type TrustBoundary,
} from '@saerskriven/model';

/** Declared groups that can be drawn as a single-parent, acyclic hierarchy. */
export function mermaidGroups(
  diagram: Diagram,
): ReadonlyMap<ElementId, readonly ElementId[]> {
  const elements = elementsById(diagram.elements);
  const boundaries = diagram.elements.filter(
    (element): element is TrustBoundary => element.kind === 'trust-boundary',
  );
  const parents = new Map<ElementId, Set<ElementId>>();
  for (const boundary of boundaries) {
    for (const member of boundary.containedElements ?? []) {
      const held = parents.get(member) ?? new Set<ElementId>();
      held.add(boundary.id);
      parents.set(member, held);
    }
  }
  const pending = new Map(
    boundaries.flatMap((boundary): [ElementId, readonly ElementId[]][] => {
      const members = [...new Set(boundary.containedElements ?? [])];
      return members.length === 0 ||
        members.some((id) => {
          const element = elements.get(id);
          return (
            element === undefined ||
            element.kind === 'flow' ||
            (parents.get(id)?.size ?? 0) > 1
          );
        })
        ? []
        : [[boundary.id, members]];
    }),
  );
  const groups = new Map<ElementId, readonly ElementId[]>();
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const [id, members] of pending) {
      if (
        members.every(
          (member) =>
            elements.get(member)?.kind !== 'trust-boundary' ||
            groups.has(member),
        )
      ) {
        groups.set(id, members);
        pending.delete(id);
        progressed = true;
      }
    }
  }
  return groups;
}
