import type { ElementId } from './ids.js';
import type { Element } from './elements.js';
import type { ParseIssue, ParseIssueCode } from './parse-issue.js';

type RelatedList = {
  readonly field: string;
  readonly ids: readonly ElementId[] | undefined;
  readonly kind: Element['kind'] | undefined;
  readonly code: Extract<ParseIssueCode, `related-${string}`>;
};

/** Checks declared relationships without inferring geometry or reciprocal assertions. */
export function relationshipIssues(
  element: Element,
  known: ReadonlyMap<ElementId, Element>,
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
      return target !== undefined &&
        reference !== element.id &&
        (kind === undefined || target.kind === kind)
        ? []
        : [
            {
              path: [field, index],
              detail: { code, parameters: { id: reference } },
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
  if (element.kind === 'flow' && element.trustBoundaryIds !== undefined) {
    return {
      ...element,
      trustBoundaryIds: element.trustBoundaryIds.filter((id) =>
        retained.has(id),
      ),
    };
  }
  if (element.kind === 'trust-boundary') {
    return {
      ...element,
      ...(element.containedElements === undefined
        ? {}
        : {
            containedElements: element.containedElements.filter((id) =>
              retained.has(id),
            ),
          }),
      ...(element.crossingFlows === undefined
        ? {}
        : {
            crossingFlows: element.crossingFlows.filter((id) =>
              retained.has(id),
            ),
          }),
    };
  }
  return element;
}
