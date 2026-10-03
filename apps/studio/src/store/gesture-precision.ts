import type { GestureInput } from '@saerskriven/canvas';
import {
  elementsAcross,
  elementsById,
  type BoundaryShape,
  type Element,
  type FlowEndpoint,
  type Model,
  type Point,
  type Size,
} from '@saerskriven/model';

/** How many decimals the store keeps of a number a gesture writes, by what made the gesture. */
export const gestureDecimals = {
  pointer: 3,
  keyboard: 1,
} as const satisfies Record<GestureInput, number>;

/**
 * `value` at the decimals a gesture made with `input` stores: the nearest
 * number with no more of them, so it reads back without the noise of the
 * arithmetic that produced it, and never negative zero.
 */
export function atGesturePrecision(value: number, input: GestureInput): number {
  const rounded = Number(value.toFixed(gestureDecimals[input]));
  return rounded === 0 ? 0 : rounded;
}

/**
 * `after`, the model a gesture made with `input` left of `before`, with what
 * the gesture wrote at {@link gestureDecimals}: each position, size, flow
 * route and curve whose numbers it changed, and the whole of an element it
 * added. A number it left alone keeps its stored value, whatever its
 * decimals, and a size stays above zero.
 */
export function modelAtGesturePrecision(
  before: Model,
  after: Model,
  input: GestureInput,
): Model {
  const held = elementsById(elementsAcross(before.diagrams));
  return {
    ...after,
    diagrams: after.diagrams.map((diagram) =>
      before.diagrams.includes(diagram)
        ? diagram
        : {
            ...diagram,
            elements: diagram.elements.map((element) => {
              const was = held.get(element.id);
              return was === element ? element : written(was, element, input);
            }),
          },
    ),
  };
}

function written(
  was: Element | undefined,
  element: Element,
  input: GestureInput,
): Element {
  if (element.kind === 'flow') {
    const flow = was?.kind === 'flow' ? was : undefined;
    return {
      ...element,
      source: writtenEnd(flow?.source, element.source, input),
      target: writtenEnd(flow?.target, element.target, input),
      waypoints: writtenRun(flow?.waypoints, element.waypoints, input),
    };
  }
  if (element.kind === 'trust-boundary') {
    const shape = was?.kind === 'trust-boundary' ? was.shape : undefined;
    return { ...element, shape: writtenShape(shape, element.shape, input) };
  }
  const box =
    was === undefined || was.kind === 'flow' || was.kind === 'trust-boundary'
      ? undefined
      : was;
  return {
    ...element,
    position: writtenPoint(box?.position, element.position, input),
    size: writtenSize(box?.size, element.size, input),
  };
}

function writtenEnd(
  was: FlowEndpoint | undefined,
  end: FlowEndpoint,
  input: GestureInput,
): FlowEndpoint {
  return end.kind === 'free'
    ? {
        ...end,
        position: writtenPoint(
          was?.kind === 'free' ? was.position : undefined,
          end.position,
          input,
        ),
      }
    : end;
}

function writtenShape(
  was: BoundaryShape | undefined,
  shape: BoundaryShape,
  input: GestureInput,
): BoundaryShape {
  if (shape.kind === 'curve') {
    const run = was?.kind === 'curve' ? was.waypoints : undefined;
    return { ...shape, waypoints: writtenRun(run, shape.waypoints, input) };
  }
  const box = was?.kind === 'box' ? was : undefined;
  return {
    ...shape,
    position: writtenPoint(box?.position, shape.position, input),
    size: writtenSize(box?.size, shape.size, input),
  };
}

function writtenRun(
  was: readonly Point[] | undefined,
  run: Point[],
  input: GestureInput,
): Point[] {
  return was?.length === run.length &&
    run.every((point, index) => samePoint(was[index], point))
    ? run
    : run.map((point) => roundedPoint(point, input));
}

function writtenPoint(
  was: Point | undefined,
  point: Point,
  input: GestureInput,
): Point {
  return samePoint(was, point) ? point : roundedPoint(point, input);
}

function writtenSize(
  was: Size | undefined,
  size: Size,
  input: GestureInput,
): Size {
  const least = 1 / 10 ** gestureDecimals[input];
  return was?.width === size.width && was.height === size.height
    ? size
    : {
        width: Math.max(least, atGesturePrecision(size.width, input)),
        height: Math.max(least, atGesturePrecision(size.height, input)),
      };
}

function samePoint(was: Point | undefined, point: Point): boolean {
  return was?.x === point.x && was.y === point.y;
}

function roundedPoint(point: Point, input: GestureInput): Point {
  return {
    x: atGesturePrecision(point.x, input),
    y: atGesturePrecision(point.y, input),
  };
}
