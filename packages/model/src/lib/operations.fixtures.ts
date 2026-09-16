import { Either } from 'effect';
import { diagramId, elementId, parsedFixture } from '../fixtures.js';
import { addElement } from './element-operations.js';
import { elementSchema, type Element, type Flow } from './elements.js';
import { validModelFixture } from './fixtures.js';
import type { OperationFailure } from './operation-failures.js';
import type { Model } from './parse.js';

export const base = parsedFixture(validModelFixture);
export const mainDiagram = diagramId('diagram-main');

export type OperationOutcome = Either.Either<Model, OperationFailure>;

export const modelOf = (result: OperationOutcome): Model => {
  if (Either.isLeft(result)) {
    throw new Error(`Expected the operation to succeed: ${result.left._tag}`);
  }
  return result.right;
};

export const errorOf = (
  result: OperationOutcome,
): OperationFailure | undefined =>
  Either.isLeft(result) ? result.left : undefined;

export const elementIds = (model: Model): string[] =>
  model.diagrams.flatMap((diagram) =>
    diagram.elements.map((element) => element.id),
  );

export const elementIn = (model: Model, id: string): Element => {
  const element = model.diagrams
    .flatMap((diagram) => diagram.elements)
    .find((candidate) => candidate.id === id);
  if (!element) {
    throw new Error(`Element ${id} is missing from the model.`);
  }
  return element;
};

export const flowIn = (model: Model, id: string): Flow => {
  const element = elementIn(model, id);
  if (element.kind !== 'flow') {
    throw new Error(`Element ${id} is not a flow.`);
  }
  return element;
};

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

export const cache = elementSchema.parse(storeInput);
export const writeFlow = elementSchema.parse(flowInput);
export const note = elementSchema.parse(noteInput);
export const withNote = modelOf(addElement(base, mainDiagram, note));

export const secondDiagram = diagramId('diagram-second');

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
