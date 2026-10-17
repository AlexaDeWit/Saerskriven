import {
  elementIdSchema,
  isEmptyName,
  type Diagram,
  type DiagramId,
  type DrawnElement,
  type DrawnFlowEndpoint,
  type ElementId,
  type Model,
} from '@saerskriven/model';
import type { ThreatDragonDiagram } from '@saerskriven/wire-threat-dragon';
import type { Divergence } from './divergence.js';
import { cellsOf } from './threat-dragon-document.js';

/** The cell id each element a diagram places is written under there. */
export type CellIds = ReadonlyMap<ElementId, ElementId>;

/** One element as a diagram's cells name it, and what writing it so cost. */
export type CelledElement = {
  readonly element: DrawnElement;
  readonly divergences: readonly Divergence[];
};

/**
 * The cell id every placement is written under, by diagram. Threat Dragon
 * draws an element as a cell on one diagram, so an element on several takes
 * a cell on each. The element's own id stays on the diagram whose cell of
 * that id `held`, the diagrams of the document written over, holds, or else
 * on the first diagram placing it, and every other diagram takes the
 * element's id joined to the diagram's with a hyphen. A derived id that an
 * element, a diagram, a threat, a mitigation, an assumption or an earlier
 * derived id already holds takes a numbered suffix, so the same model and
 * document write the same ids.
 */
export function cellIdsOf(
  model: Model,
  held: ReadonlyMap<string, ThreatDragonDiagram> = new Map(),
): ReadonlyMap<DiagramId, CellIds> {
  const taken = new Set<string>([
    ...model.elements.map(({ id }) => id),
    ...model.diagrams.map(({ id }) => id),
    ...model.threats.map(({ id }) => id),
    ...model.mitigations.map(({ id }) => id),
    ...model.assumptions.map(({ id }) => id),
  ]);
  const homes = homesOf(model, held);
  return new Map(
    model.diagrams.map((diagram) => [
      diagram.id,
      new Map(
        diagram.placements.map(({ element }): [ElementId, ElementId] => {
          if (homes.get(element) === diagram.id) {
            return [element, element];
          }
          const derived = freeId(element, diagram.id, taken);
          taken.add(derived);
          return [element, derived];
        }),
      ),
    ]),
  );
}

/**
 * Each element placed on more than one diagram, reported once as split
 * across the cells it is written as, naming its diagrams by title, or by id
 * where the title is blank.
 */
export function splitElements(model: Model): readonly Divergence[] {
  return model.elements.flatMap((element): Divergence[] => {
    const diagrams = model.diagrams.filter(({ placements }) =>
      placements.some((placement) => placement.element === element.id),
    );
    return diagrams.length < 2
      ? []
      : [
          {
            subject: { kind: 'element', id: element.id },
            detail: {
              code: 'element-split-across-diagrams',
              parameters: { diagrams: diagrams.map(diagramName) },
            },
            reason: 'split',
          },
        ];
  });
}

/**
 * `element` as the cells of `diagram` name it: its own cell id, its flow ends
 * fastened to the cells of that diagram, and its relationship lists naming
 * the cells that diagram places. An end drawn away from an element the
 * diagram does not place is written as a free end at its point, and a list
 * leaves out an element the diagram does not place, each reported, the list
 * naming the diagram.
 */
export function inCellTerms(
  element: DrawnElement,
  cellIds: CellIds,
  diagram: Diagram,
): CelledElement {
  const id = cellIds.get(element.id) ?? element.id;
  if (element.kind === 'flow') {
    const source = freedEnd(element.source, cellIds);
    const target = freedEnd(element.target, cellIds);
    const boundaries = keptIds(element.trustBoundaryIds, cellIds);
    return {
      element: {
        ...element,
        id,
        source: source.end,
        target: target.end,
        ...(boundaries.ids === undefined
          ? {}
          : { trustBoundaryIds: boundaries.ids }),
      },
      divergences: [
        ...[source.away, target.away].flatMap((away) =>
          away === undefined ? [] : [freedDivergence(element.id, away)],
        ),
        ...droppedDivergence(element.id, boundaries.dropped, diagram),
      ],
    };
  }
  if (element.kind === 'trust-boundary') {
    const contained = keptIds(element.containedElements, cellIds);
    const crossing = keptIds(element.crossingFlows, cellIds);
    return {
      element: {
        ...element,
        id,
        ...(contained.ids === undefined
          ? {}
          : { containedElements: contained.ids }),
        ...(crossing.ids === undefined ? {} : { crossingFlows: crossing.ids }),
      },
      divergences: droppedDivergence(
        element.id,
        contained.dropped + crossing.dropped,
        diagram,
      ),
    };
  }
  return { element: { ...element, id }, divergences: [] };
}

function homesOf(
  model: Model,
  held: ReadonlyMap<string, ThreatDragonDiagram>,
): ReadonlyMap<ElementId, DiagramId> {
  const homes = new Map<ElementId, DiagramId>();
  for (const diagram of model.diagrams) {
    const source = held.get(diagram.id);
    const cells = new Set<string>(
      source === undefined ? [] : cellsOf(source).map(({ id }) => id),
    );
    for (const { element } of diagram.placements) {
      if (cells.has(element) && !homes.has(element)) {
        homes.set(element, diagram.id);
      }
    }
  }
  for (const diagram of model.diagrams) {
    for (const { element } of diagram.placements) {
      if (!homes.has(element)) {
        homes.set(element, diagram.id);
      }
    }
  }
  return homes;
}

function freeId(
  element: ElementId,
  diagram: DiagramId,
  taken: ReadonlySet<string>,
): ElementId {
  const wanted = `${element}-${diagram}`;
  let suffix = 2;
  let candidate = wanted;
  while (taken.has(candidate)) {
    candidate = `${wanted}-${String(suffix)}`;
    suffix += 1;
  }
  return elementIdSchema.parse(candidate);
}

function freedEnd(
  end: DrawnFlowEndpoint,
  cellIds: CellIds,
): { readonly end: DrawnFlowEndpoint; readonly away?: ElementId } {
  if (end.kind === 'free') {
    return { end };
  }
  if (end.kind === 'away') {
    return { end: { kind: 'free', position: end.position }, away: end.element };
  }
  return { end: { ...end, element: cellIds.get(end.element) ?? end.element } };
}

function keptIds(
  ids: readonly ElementId[] | undefined,
  cellIds: CellIds,
): { readonly ids?: ElementId[]; readonly dropped: number } {
  if (ids === undefined) {
    return { dropped: 0 };
  }
  const kept = ids.flatMap((held) => {
    const cell = cellIds.get(held);
    return cell === undefined ? [] : [cell];
  });
  return { ids: kept, dropped: ids.length - kept.length };
}

function freedDivergence(flow: ElementId, element: ElementId): Divergence {
  return {
    subject: { kind: 'element', id: flow },
    detail: { code: 'flow-end-drawn-away-freed', parameters: { element } },
    reason: 'unrepresentable',
  };
}

function droppedDivergence(
  element: ElementId,
  count: number,
  diagram: Diagram,
): readonly Divergence[] {
  return count === 0
    ? []
    : [
        {
          subject: { kind: 'element', id: element },
          detail: {
            code: 'relationships-off-diagram-dropped',
            parameters: { count, diagram: diagramName(diagram) },
          },
          reason: 'unrepresentable',
        },
      ];
}

function diagramName({ id, title }: Diagram): string {
  return isEmptyName(title) ? id : title;
}
