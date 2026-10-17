import {
  boxOfPoints,
  gridSpacing,
  layoutDiagram,
  shiftedBy,
  type CanvasLayout,
} from '@saerskriven/canvas';
import {
  diagramsOf,
  elementIdsIn,
  firstDrawings,
  type Diagram,
  type DiagramId,
  type DrawnElement,
  type DrawnFlow,
  type DrawnFlowEndpoint,
  type Element,
  type ElementId,
  type Model,
  type PlacedFlowEnd,
  type Placement,
  type Point,
  type Size,
} from '@saerskriven/model';
import { diagramTitle } from '../messages/diagram-title.js';
import { Action } from '../store/actions.js';
import { activeDiagram } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { changedModel, dispatch, modelStore } from '../store/store.js';
import { externalStore } from '../ui/external-store.js';
import { announce } from './announcements.js';
import { focusCanvas, focusElement } from './edits.js';
import { commandDecimals } from './stored-decimals.js';

/** An element the diagram on screen does not place, and every diagram that does. */
export type ExistingEntry = {
  readonly element: Element;
  readonly diagrams: readonly Diagram[];
};

/** What Add existing element offers: the elements, and apart from them the flows. */
export type ExistingEntries = {
  readonly elements: readonly ExistingEntry[];
  readonly flows: readonly ExistingEntry[];
};

/**
 * What the picker under the card is open for: adding existing elements to
 * the diagram on screen, or choosing the element to merge into `into`.
 */
export type PickerMode =
  | { readonly kind: 'add' }
  | { readonly kind: 'merge'; readonly into: ElementId };

type Draft = {
  readonly from: DiagramId;
  readonly points: readonly Point[];
  readonly at: (offset: Point) => Placement;
};

type DraftedEnd = Point | 'follows' | undefined;

const rowGap = 2 * gridSpacing;

const origin: Point = { x: 0, y: 0 };

let mode: PickerMode | undefined;

let opener: HTMLElement | SVGElement | undefined;

const pickerStore = externalStore(() => mode);

/**
 * Opens the picker over the diagram on screen, or moves focus into it where
 * it is already open. Where that diagram already places every element, it
 * opens nothing and says so.
 */
export function openAddExisting(): void {
  if (mode?.kind === 'add') {
    focusAddExisting();
    return;
  }
  const state = modelStore.getState();
  const diagram = activeDiagram(state);
  if (diagram === undefined) {
    return;
  }
  if (!offersExisting(state)) {
    announce((t) =>
      t('canvas.nothing-to-add', { diagram: diagramTitle(diagram.title, t) }),
    );
    return;
  }
  openPicker({ kind: 'add' });
}

/**
 * Opens the picker in `next`'s mode, or moves focus into it where it is
 * already open in that mode. A picker open in another mode switches to
 * `next` and keeps what held focus when it first opened.
 */
export function openPicker(next: PickerMode): void {
  if (samePickerMode(mode, next)) {
    focusAddExisting();
    return;
  }
  if (mode === undefined) {
    const focused = document.activeElement;
    opener =
      focused instanceof HTMLElement || focused instanceof SVGElement
        ? focused
        : undefined;
  }
  mode = next;
  pickerStore.notify();
}

/**
 * Puts the picker away with nothing changed, and hands focus back to what held
 * it when the picker opened, or to the canvas where that is gone.
 */
export function cancelAddExisting(): void {
  const back = opener;
  closeAddExisting();
  if (back?.isConnected === true) {
    back.focus();
  } else {
    focusCanvas();
  }
}

/** Puts the picker away. */
export function closeAddExisting(): void {
  if (mode === undefined) {
    return;
  }
  mode = undefined;
  opener = undefined;
  pickerStore.notify();
}

/** What the picker is open for, and undefined while it is closed. */
export function usePickerMode(): PickerMode | undefined {
  return pickerStore.use();
}

/** Focuses the open picker's first control, and answers whether there was one. */
export function focusAddExisting(): boolean {
  const control = document.querySelector<HTMLElement>(
    '[data-add-existing] input, [data-add-existing] button',
  );
  control?.focus();
  return control !== null;
}

/** Whether the diagram on screen leaves an element of the model off. */
export function offersExisting(
  state: Pick<State, 'present' | 'activeDiagram'>,
): boolean {
  const diagram = activeDiagram(state);
  if (diagram === undefined) {
    return false;
  }
  const placed = elementIdsIn(diagram);
  return state.present.elements.some(({ id }) => !placed.has(id));
}

/** The elements and the flows `diagramId` does not place, in the model's order, each with the diagrams that do. */
export function existingEntries(
  model: Model,
  diagramId: DiagramId,
): ExistingEntries {
  const diagram = model.diagrams.find(({ id }) => id === diagramId);
  const placed = diagram === undefined ? undefined : elementIdsIn(diagram);
  const entries =
    placed === undefined
      ? []
      : entriesOf(
          model,
          model.elements.filter(({ id }) => !placed.has(id)),
        );
  return {
    elements: entries.filter(({ element }) => element.kind !== 'flow'),
    flows: entries.filter(({ element }) => element.kind === 'flow'),
  };
}

/** Each of `elements` as a picker entry, with the diagrams of `model` that place it. */
export function entriesOf(
  model: Model,
  elements: readonly Element[],
): ExistingEntry[] {
  return elements.map((element) => ({
    element,
    diagrams: diagramsOf(model, element.id),
  }));
}

/**
 * The placements that add `picked` to `diagramId` around `centre`, the
 * elements before the flows, leaving out what the diagram already places.
 * Each takes the geometry of its first placement, without its accent. The
 * picks one diagram holds keep their layout there, the picks of each diagram
 * stand side by side, and the row is centred on `centre`. A flow takes no
 * bends: an end whose element the diagram will place follows the route, and
 * any other end is drawn where its first placement draws it.
 */
export function existingPlacements(
  model: Model,
  diagramId: DiagramId,
  picked: readonly ElementId[],
  centre: Point,
): readonly Placement[] {
  const diagram = model.diagrams.find(({ id }) => id === diagramId);
  if (diagram === undefined) {
    return [];
  }
  const onDiagram = elementIdsIn(diagram);
  const chosen = new Set<string>(picked.filter((id) => !onDiagram.has(id)));
  const placed = new Set<string>([...onDiagram, ...chosen]);
  const layouts = new Map<DiagramId, CanvasLayout>();
  const layoutOf = (from: Diagram): CanvasLayout => {
    const held = layouts.get(from.id) ?? layoutDiagram(from, model);
    layouts.set(from.id, held);
    return held;
  };
  const ordered = [
    ...model.elements.filter(
      ({ id, kind }) => chosen.has(id) && kind !== 'flow',
    ),
    ...model.elements.filter(
      ({ id, kind }) => chosen.has(id) && kind === 'flow',
    ),
  ];
  const drawings = new Map(
    firstDrawings(model).map((drawing) => [drawing.element.id, drawing]),
  );
  const drafts = ordered.flatMap(({ id }) => {
    const drawing = drawings.get(id);
    return drawing === undefined
      ? []
      : [draftOf(drawing.diagram, drawing.drawn, placed, centre, layoutOf)];
  });
  const offsets = rowOffsets(drafts, centre);
  return drafts.map((draft) => draft.at(offsets.get(draft.from) ?? origin));
}

/**
 * Adds `picked` to the diagram on screen around `centre` as one undo step,
 * stored at `commandDecimals`, then selects what it added, focuses the first
 * of it and says how many it added.
 */
export function addExisting(
  picked: readonly ElementId[],
  centre: Point,
): boolean {
  const state = modelStore.getState();
  const diagram = activeDiagram(state);
  if (diagram === undefined) {
    return false;
  }
  const placements = existingPlacements(
    state.present,
    diagram.id,
    picked,
    centre,
  );
  const added = placements.map(({ element }) => element);
  const [first] = added;
  if (
    first === undefined ||
    !changedModel(
      Action.PlaceElements({
        diagramId: diagram.id,
        placements,
        decimals: commandDecimals,
      }),
    )
  ) {
    return false;
  }
  dispatch(Action.Select({ elementIds: added }));
  focusElement(first);
  announce((t) =>
    t('canvas.added-existing', {
      count: added.length,
      diagram: diagramTitle(diagram.title, t),
    }),
  );
  return true;
}

function samePickerMode(
  held: PickerMode | undefined,
  next: PickerMode,
): boolean {
  return (
    held?.kind === next.kind &&
    (held.kind === 'add' || (next.kind === 'merge' && held.into === next.into))
  );
}

function draftOf(
  from: Diagram,
  drawn: DrawnElement,
  placed: ReadonlySet<string>,
  centre: Point,
  layoutOf: (diagram: Diagram) => CanvasLayout,
): Draft {
  const element = drawn.id;
  if (drawn.kind === 'flow') {
    return flowDraft(from, drawn, placed, centre, layoutOf(from));
  }
  if (drawn.kind !== 'trust-boundary') {
    return {
      from: from.id,
      points: corners(drawn.position, drawn.size),
      at: (offset) => ({
        element,
        position: shiftedBy(drawn.position, offset),
        size: drawn.size,
      }),
    };
  }
  const { shape } = drawn;
  return shape.kind === 'curve'
    ? {
        from: from.id,
        points: shape.waypoints,
        at: (offset) => ({
          element,
          shape: {
            kind: 'curve',
            waypoints: shape.waypoints.map((point) => shiftedBy(point, offset)),
          },
        }),
      }
    : {
        from: from.id,
        points: corners(shape.position, shape.size),
        at: (offset) => ({
          element,
          shape: { ...shape, position: shiftedBy(shape.position, offset) },
        }),
      };
}

function flowDraft(
  from: Diagram,
  flow: DrawnFlow,
  placed: ReadonlySet<string>,
  centre: Point,
  layout: CanvasLayout,
): Draft {
  const edge = layout.edges.find(({ id }) => id === flow.id);
  const source = draftedEnd(flow.source, edge?.source, placed);
  const target = draftedEnd(flow.target, edge?.target, placed);
  return {
    from: from.id,
    points: [source, target].filter(
      (end): end is Point => end !== undefined && end !== 'follows',
    ),
    at: (offset) => ({
      element: flow.id,
      waypoints: [],
      source: placedEnd(source, offset, centre),
      target: placedEnd(target, offset, centre),
    }),
  };
}

function draftedEnd(
  end: DrawnFlowEndpoint,
  drawnAt: Point | undefined,
  placed: ReadonlySet<string>,
): DraftedEnd {
  if (end.kind !== 'free' && placed.has(end.element)) {
    return 'follows';
  }
  return end.kind === 'attached' ? drawnAt : end.position;
}

function placedEnd(
  end: DraftedEnd,
  offset: Point,
  centre: Point,
): PlacedFlowEnd {
  if (end === 'follows') {
    return {};
  }
  return { position: end === undefined ? centre : shiftedBy(end, offset) };
}

function rowOffsets(
  drafts: readonly Draft[],
  centre: Point,
): ReadonlyMap<DiagramId, Point> {
  const pointsOf = new Map<DiagramId, readonly Point[]>();
  for (const { from, points } of drafts) {
    pointsOf.set(from, [...(pointsOf.get(from) ?? []), ...points]);
  }
  const boxes = [...pointsOf].flatMap(([from, points]) => {
    const box = boxOfPoints(points);
    return box === undefined ? [] : [{ from, box }];
  });
  const width =
    boxes.reduce((total, { box }) => total + box.maxX - box.minX, 0) +
    rowGap * Math.max(boxes.length - 1, 0);
  const offsets = new Map<DiagramId, Point>();
  let left = centre.x - width / 2;
  for (const { from, box } of boxes) {
    offsets.set(from, {
      x: left - box.minX,
      y: centre.y - (box.minY + box.maxY) / 2,
    });
    left += box.maxX - box.minX + rowGap;
  }
  return offsets;
}

function corners(position: Point, size: Size): readonly Point[] {
  return [
    position,
    { x: position.x + size.width, y: position.y + size.height },
  ];
}
