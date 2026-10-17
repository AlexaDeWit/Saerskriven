import type { ElementId } from './ids.js';
import type { Element } from './elements.js';
import { sameItems } from './lists.js';
import type { ParseIssue, ParseIssueCode } from './parse-issue.js';

type RelatedList = {
  readonly field: string;
  readonly ids: readonly ElementId[] | undefined;
  readonly kind: Element['kind'] | undefined;
  readonly code: Extract<ParseIssueCode, `related-${string}-unknown`>;
};

/**
 * Checks declared relationships without inferring geometry or reciprocal
 * assertions. Each id names another element of the list's kind in `known`,
 * and one `reachable` holds, where a read keeps a list inside the element's
 * own diagram.
 */
export function relationshipIssues(
  element: Element,
  known: ReadonlyMap<ElementId, Element>,
  reachable: ReadonlyMap<ElementId, Element> = known,
): ParseIssue[] {
  const lists: readonly RelatedList[] =
    element.kind === 'flow'
      ? [
          {
            field: 'trustBoundaryIds',
            ids: element.trustBoundaryIds,
            kind: 'trust-boundary',
            code: 'related-boundary-unknown',
          },
        ]
      : element.kind === 'trust-boundary'
        ? [
            {
              field: 'containedElements',
              ids: element.containedElements,
              kind: undefined,
              code: 'related-element-unknown',
            },
            {
              field: 'crossingFlows',
              ids: element.crossingFlows,
              kind: 'flow',
              code: 'related-flow-unknown',
            },
          ]
        : [];
  return lists.flatMap(({ field, ids, kind, code }) =>
    (ids ?? []).flatMap((reference, index): ParseIssue[] => {
      const target = known.get(reference);
      const named =
        target !== undefined &&
        reference !== element.id &&
        (kind === undefined || target.kind === kind);
      if (named && reachable.has(reference)) {
        return [];
      }
      return [
        {
          path: [field, index],
          detail: {
            code: named ? 'related-off-diagram' : code,
            parameters: { id: reference },
          },
        },
      ];
    }),
  );
}

/** Restricts declared lists after explicit deletion or selection copying, retaining absent and empty lists. */
export function restrictRelationships(
  element: Element,
  retained: ReadonlySet<string>,
): Element {
  return relistedRelationships(element, (ids) =>
    ids.filter((id) => retained.has(id)),
  );
}

/**
 * `element` with each relationship list it holds replaced by what `relist`
 * returns for it, an absent list left absent. Where every list comes back
 * with the ids it held, in order, `element` itself comes back.
 */
export function relistedRelationships(
  element: Element,
  relist: (ids: readonly ElementId[]) => ElementId[],
): Element {
  if (element.kind === 'flow') {
    const trustBoundaryIds = relistedOrHeld(element.trustBoundaryIds, relist);
    return trustBoundaryIds === element.trustBoundaryIds ||
      trustBoundaryIds === undefined
      ? element
      : { ...element, trustBoundaryIds };
  }
  if (element.kind === 'trust-boundary') {
    const containedElements = relistedOrHeld(element.containedElements, relist);
    const crossingFlows = relistedOrHeld(element.crossingFlows, relist);
    return containedElements === element.containedElements &&
      crossingFlows === element.crossingFlows
      ? element
      : {
          ...element,
          ...(containedElements === undefined ? {} : { containedElements }),
          ...(crossingFlows === undefined ? {} : { crossingFlows }),
        };
  }
  return element;
}

function relistedOrHeld(
  held: ElementId[] | undefined,
  relist: (ids: readonly ElementId[]) => ElementId[],
): ElementId[] | undefined {
  if (held === undefined) {
    return undefined;
  }
  const next = relist(held);
  return sameItems(held, next) ? held : next;
}
