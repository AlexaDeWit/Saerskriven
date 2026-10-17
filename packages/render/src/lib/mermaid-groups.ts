import {
  elementsById,
  type DrawnElement,
  type DrawnTrustBoundary,
  type ElementId,
} from '@saerskriven/model';

/**
 * The declared groups among one diagram's elements that can be drawn as a
 * single-parent, acyclic hierarchy, each holding the members the diagram
 * places.
 */
export function mermaidGroups(
  drawn: readonly DrawnElement[],
): ReadonlyMap<ElementId, readonly ElementId[]> {
  const elements = elementsById(drawn);
  const boundaries = drawn.filter(
    (element): element is DrawnTrustBoundary =>
      element.kind === 'trust-boundary',
  );
  const placedMembers = (boundary: DrawnTrustBoundary): ElementId[] => [
    ...new Set(
      (boundary.containedElements ?? []).filter((id) => elements.has(id)),
    ),
  ];
  const parents = new Map<ElementId, Set<ElementId>>();
  for (const boundary of boundaries) {
    for (const member of placedMembers(boundary)) {
      const held = parents.get(member) ?? new Set<ElementId>();
      held.add(boundary.id);
      parents.set(member, held);
    }
  }
  const pending = new Map(
    boundaries.flatMap((boundary): [ElementId, readonly ElementId[]][] => {
      const members = placedMembers(boundary);
      return members.length === 0 ||
        members.some(
          (id) =>
            elements.get(id)?.kind === 'flow' ||
            (parents.get(id)?.size ?? 0) > 1,
        )
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
