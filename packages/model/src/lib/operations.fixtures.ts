import { Either } from 'effect';
import {
  attached,
  boxAt,
  curveBoundary,
  diagramId,
  elementId,
  flowBetween,
  modelWith,
  validModel,
} from '../fixtures.js';
import { addElement } from './element-operations.js';
import { elementSchema, type Element } from './elements.js';
import type { Point } from './geometry.js';
import type { OperationFailure } from './operation-failures.js';
import { parseModel, type Model } from './parse.js';

type OperationOutcome = Either.Either<Model, OperationFailure>;

/** The model an operation succeeded with, throwing with the failure's tag where it did not. */
export const modelOf = (result: OperationOutcome): Model =>
  Either.getOrThrowWith(
    result,
    (failure) =>
      new Error(`Expected the operation to succeed: ${failure._tag}`),
  );

/** The failure an operation returned, undefined where it succeeded. */
export const errorOf = (
  result: OperationOutcome,
): OperationFailure | undefined =>
  Either.isLeft(result) ? result.left : undefined;

type OperationCase = {
  readonly input: Model;
  readonly run: (input: Model) => unknown;
};

/**
 * Registers one test per named case. Each runs its call inside the test and
 * asserts that the input is unchanged, whatever the call returned. Where it
 * returned a success holding a model, `parseModel` must accept that model.
 */
export function operationContract(
  cases: Readonly<Record<string, OperationCase>>,
): void {
  it.each(Object.entries(cases))(
    '%s leaves its input untouched, and any model it returns parses',
    (_, { input, run }) => {
      const pristine = structuredClone(input);
      const result = run(input);
      expect(input).toEqual(pristine);
      if (Either.isEither(result) && Either.isRight(result)) {
        expect(Either.isRight(parseModel(result.right))).toBe(true);
      }
    },
  );
}

/** The diagram {@link validModel} holds. */
export const mainDiagram = diagramId('diagram-main');

/** The ids of every element across the model's diagrams, in order. */
export const elementIds = (model: Model): string[] =>
  model.diagrams.flatMap((diagram) =>
    diagram.elements.map((element) => element.id),
  );

/** A store the valid model does not hold, in the schema's input shape. */
export const storeInput = {
  kind: 'store',
  id: 'element-cache',
  name: 'Session cache',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  position: { x: 600, y: 320 },
  size: { width: 160, height: 80 },
};

/** A flow between two elements of the valid model, in the schema's input shape. */
export const flowInput = {
  kind: 'flow',
  id: 'element-write-flow',
  name: 'Write order',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  source: { kind: 'attached', element: 'element-api' },
  target: { kind: 'attached', element: 'element-db' },
  waypoints: [],
  bidirectional: false,
};

const noteInput = {
  kind: 'text',
  id: 'element-note',
  name: 'Note',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  text: 'Draft note',
  position: { x: 600, y: 440 },
  size: { width: 200, height: 80 },
};

/** {@link storeInput}, parsed. */
export const cache = elementSchema.parse(storeInput);

/** {@link flowInput}, parsed. */
export const writeFlow = elementSchema.parse(flowInput);

/** A text note, parsed. */
export const note = elementSchema.parse(noteInput);

/** The valid model with {@link note} added to its diagram. */
export const withNote = modelOf(addElement(validModel, mainDiagram, note));

/** The process of {@link noisyModel}, whose height rounds to zero at one decimal. */
export const noisyProcess = elementId('noisy-process');

/** The store of {@link noisyModel}, which its flow starts on. */
export const noisyStore = elementId('noisy-store');

/** The flow of {@link noisyModel}, with one bend and a free target. */
export const noisyFlow = elementId('noisy-flow');

/** The trust boundary box of {@link noisyModel}. */
export const noisyBox = elementId('noisy-box');

/** The trust boundary curve of {@link noisyModel}. */
export const noisyCurve = elementId('noisy-curve');

/** The diagram {@link noisyModel} holds. */
export const noisyDiagram = diagramId('d');

/**
 * A model whose geometry carries the decimals arithmetic leaves where nothing
 * rounds: a process, a store, a flow from the store through one bend to a
 * free end, a trust boundary box and a trust boundary curve.
 */
export const noisyModel: Model = modelWith({
  elements: [
    boxAt(noisyProcess, 123.63636363636364, 5.1, 'process', {
      width: 120.123456,
      height: 0.04,
    }),
    boxAt(noisyStore, 300.0004, 0.04, 'store'),
    {
      ...flowBetween(
        attached(noisyStore),
        { kind: 'free', position: { x: 500.55555, y: 200.4444 } },
        [{ x: 250.123456, y: 99.98765 }],
      ),
      id: noisyFlow,
    },
    {
      ...curveBoundary(noisyBox, [], 'Box'),
      shape: {
        kind: 'box',
        position: { x: 10.123456, y: -20.98765 },
        size: { width: 400.5558, height: 300.4444 },
      },
    },
    curveBoundary(
      noisyCurve,
      [
        { x: -20.3333, y: 80.6666 },
        { x: 200.1111, y: -20.2222 },
        { x: 440.9999, y: 80.5558 },
      ],
      'Curve',
    ),
  ],
});

/** Every point an element holds: its position, its free ends and bends, or its curve points. */
export const pointsOf = (element: Element): readonly Point[] => {
  if (element.kind === 'flow') {
    return [
      ...[element.source, element.target].flatMap((end) =>
        end.kind === 'free' ? [end.position] : [],
      ),
      ...element.waypoints,
    ];
  }
  if (element.kind === 'trust-boundary') {
    return element.shape.kind === 'box'
      ? [element.shape.position]
      : element.shape.waypoints;
  }
  return [element.position];
};

/** A diagram id the valid model does not hold. */
export const secondDiagram = diagramId('diagram-second');
