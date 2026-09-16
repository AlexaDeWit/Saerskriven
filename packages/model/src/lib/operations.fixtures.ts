import { Either } from 'effect';
import { diagramId, elementId, validModel } from '../fixtures.js';
import { addElement } from './element-operations.js';
import { elementSchema } from './elements.js';
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

/** A diagram id the valid model does not hold. */
export const secondDiagram = diagramId('diagram-second');

/** A second diagram whose flow stays inside it. */
export const secondOfElements = {
  id: secondDiagram,
  title: 'Second',
  elements: [
    { ...cache, id: elementId('element-second-store') },
    elementSchema.parse({
      ...flowInput,
      id: 'element-second-flow',
      source: { kind: 'attached', element: 'element-second-store' },
      target: { kind: 'free', position: { x: 0, y: 0 } },
    }),
  ],
};
