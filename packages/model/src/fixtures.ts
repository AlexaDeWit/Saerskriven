import { Either } from 'effect';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { threatCategorySchema } from './lib/categories.js';
import {
  drawnElementOn,
  drawnElements,
  elementOf,
  placementOf,
  placementOn,
} from './lib/drawing.js';
import type { DrawnElement, DrawnFlow } from './lib/drawn-elements.js';
import {
  emptyRegisterFixture,
  threatRegisterFixture,
  validModelFixture,
} from './lib/model.fixtures.js';
import {
  assumptionIdSchema,
  diagramIdSchema,
  elementIdSchema,
  mitigationIdSchema,
  threatIdSchema,
  type AssumptionId,
  type DiagramId,
  type ElementId,
  type MitigationId,
  type ThreatId,
} from './lib/ids.js';
import type { DrawnModelInput, ModelInput } from './lib/model.js';
import { parseDrawnModel } from './lib/parse-drawn.js';
import type { Placement } from './lib/placements.js';
import { issueLine, parseIssueText } from './lib/parse-issue.js';
import { parseModel, type Model, type ParseFailure } from './lib/parse.js';
import type { Threat } from './lib/threats.js';

export {
  assumptionOf,
  attached,
  boxAt,
  curveBoundary,
  flowBetween,
  flowFrom,
  mitigationOf,
  modelFrom,
  modelWith,
  threatOf,
} from './lib/builders.fixtures.js';
export {
  floodingEntries,
  floodingEntryCount,
} from './lib/issue-flood.fixtures.js';
export { validModelFixture } from './lib/model.fixtures.js';
export { modelInputArbitrary } from './lib/model-input.fixtures.js';
export { parseIssueSamples } from './lib/parse-issue.fixtures.js';
export {
  securityModelFixture,
  securityPropertyFixtures,
} from './lib/security.fixtures.js';

/** Parses a spec's literal string into a branded element id. */
export const elementId = (value: string): ElementId =>
  elementIdSchema.parse(value);

/** Parses a spec's literal string into a branded diagram id. */
export const diagramId = (value: string): DiagramId =>
  diagramIdSchema.parse(value);

/** Parses a spec's literal string into a branded threat id. */
export const threatId = (value: string): ThreatId =>
  threatIdSchema.parse(value);

/** Parses a spec's literal string into a branded mitigation id. */
export const mitigationId = (value: string): MitigationId =>
  mitigationIdSchema.parse(value);

/** Parses a spec's literal string into a branded assumption id. */
export const assumptionId = (value: string): AssumptionId =>
  assumptionIdSchema.parse(value);

/** A broken fixture throws with the model's path-bearing issues. */
export function parsedFixture(input: ModelInput): Model {
  return fixtureOf(parseModel(input));
}

/**
 * A fixture whose diagrams own their elements, parsed through
 * `parseDrawnModel`. A broken one throws with its path-bearing issues.
 */
export function drawnFixture(input: DrawnModelInput): Model {
  return fixtureOf(parseDrawnModel(input));
}

/** The model a parse produced, throwing with its path-bearing issues where it refused. */
export function fixtureOf(parsed: Either.Either<Model, ParseFailure>): Model {
  return Either.getOrThrowWith(
    parsed,
    (failure) =>
      new Error(
        `Fixture does not parse: ${failure.issues.map((issue) => issueLine(issue, parseIssueText)).join('; ')}`,
      ),
  );
}

/** {@link validModelFixture}, parsed. */
export const validModel: Model = drawnFixture(validModelFixture);

/** {@link threatRegisterFixture}, parsed. */
export const registerModel: Model = drawnFixture(threatRegisterFixture);

/** {@link emptyRegisterFixture}, parsed. */
export const emptyRegisterModel: Model = drawnFixture(emptyRegisterFixture);

/**
 * Each methodology with a closed category list, beside that list, read from
 * `threatCategorySchema` so a category added there reaches every spec that
 * walks them.
 */
export const enumeratedCategories = threatCategorySchema.options.flatMap(
  (option): [string, readonly string[]][] =>
    'options' in option.shape.category
      ? [[option.shape.methodology.value, option.shape.category.options]]
      : [],
);

/**
 * A character the model's text rule refuses, invisible where a literal would
 * sit in a spec.
 */
export const softHyphen = '\u00AD';

/**
 * The checkout root in its resolved form, which is the form the MCP server's
 * confinement check compares against.
 */
export const repositoryRoot = realpathSync(
  join(import.meta.dirname, '../../..'),
);

/** A path under the committed `test-data` directory. */
export const testDataPath = (...segments: readonly string[]): string =>
  join(repositoryRoot, 'test-data', ...segments);

/**
 * The text of a committed file under `test-data`. The read happens at the
 * call, so importing this entry reads no file. A consumer lists the file
 * among its nx test inputs.
 */
export const committedText = (...segments: readonly string[]): string =>
  readFileSync(testDataPath(...segments), 'utf8');

/**
 * The SHA-256 digest of bytes as hex, which is how a binary golden is
 * compared: a failed comparison of the buffers themselves is pretty-printed
 * and diffed element by element, which takes minutes on a picture and
 * reports nothing while it runs.
 */
export const sha256Of = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

/**
 * `model` with its description replaced by `bytes` of SHAKE256 output as
 * base64, which no compressor shortens, so a share link of it is about as long
 * as that text whatever the rest of the model holds.
 */
export const incompressibleModel = (model: Model, bytes: number): Model => ({
  ...model,
  metadata: {
    ...model.metadata,
    description: createHash('shake256', { outputLength: bytes })
      .update('share-link')
      .digest('base64'),
  },
});

/**
 * Reads and parses a committed model under `test-data`. The read happens at
 * the call, so importing this entry reads no file. A consumer lists the file
 * among its nx test inputs.
 */
export const committedModel = (name: string): Model =>
  fixtureOf(parseModel(JSON.parse(committedText(name))));

/**
 * Every diagram the canvas and render suites draw from committed data: a test
 * title, the model's file under `test-data` as {@link committedModel} takes
 * it, and the diagram's index in that model. It names files and reads none,
 * so each suite loads the models itself and lists the files among its inputs.
 */
export const committedDiagrams: readonly {
  readonly name: string;
  readonly file: string;
  readonly diagram: number;
}[] = [
  { name: 'every glyph', file: 'every-glyph.model.json', diagram: 0 },
  {
    name: 'the storefront diagram',
    file: 'two-diagrams.model.json',
    diagram: 0,
  },
  {
    name: 'the fulfilment diagram',
    file: 'two-diagrams.model.json',
    diagram: 1,
  },
  { name: 'every accent', file: 'accents.model.json', diagram: 0 },
];

/**
 * The element under the id as the first diagram placing it draws it,
 * throwing where no diagram does.
 */
export const elementIn = (model: Model, id: string): DrawnElement => {
  const element = model.diagrams
    .map((diagram) => drawnElementOn(model, diagram, elementId(id)))
    .find((candidate) => candidate !== undefined);
  if (!element) {
    throw new Error(`Element ${id} is missing from the model.`);
  }
  return element;
};

/**
 * The elements of the model's diagram at `index`, the first where none is
 * named, as that diagram draws them: empty where the model holds no such
 * diagram, and where there is no model.
 */
export const drawnAt = (
  model: Model | undefined,
  index = 0,
): DrawnElement[] => {
  const diagram = model?.diagrams.at(index);
  return model === undefined || diagram === undefined
    ? []
    : drawnElements(model, diagram);
};

/**
 * Every element the model's diagrams draw, as they draw them, in diagram
 * order: empty where there is no model.
 */
export const drawnAcross = (model: Model | undefined): DrawnElement[] =>
  model === undefined
    ? []
    : model.diagrams.flatMap((diagram) => drawnElements(model, diagram));

/**
 * `model` with each element as `redraw` returns it from the diagram that
 * draws it, given its index in that diagram's draw order, split back into
 * the element and its placement. No parse runs, so
 * a spec can hand over a model the parser would refuse.
 */
export const redrawn = (
  model: Model,
  redraw: (element: DrawnElement, index: number) => DrawnElement,
): Model => {
  const diagrams = model.diagrams.map((diagram) => ({
    diagram,
    drawn: drawnElements(model, diagram).map((element, index) =>
      redraw(element, index),
    ),
  }));
  const byId = new Map(
    diagrams.flatMap(({ drawn }) =>
      drawn.map((element) => [element.id, element] as const),
    ),
  );
  return {
    ...model,
    elements: model.elements.map((element) => {
      const drawn = byId.get(element.id);
      return drawn === undefined ? element : elementOf(drawn);
    }),
    diagrams: diagrams.map(({ diagram, drawn }) => ({
      ...diagram,
      placements: drawn.map(placementOf),
    })),
  };
};

/**
 * `model` with each of `added` held at its root and placed last on the
 * diagram at `index`, the first where none is named. No parse runs, as for
 * {@link redrawn}.
 */
export const drawnOnto = (
  model: Model,
  added: readonly DrawnElement[],
  index = 0,
): Model => ({
  ...model,
  elements: [...model.elements, ...added.map(elementOf)],
  diagrams: model.diagrams.map((diagram, at) =>
    at === index
      ? {
          ...diagram,
          placements: [...diagram.placements, ...added.map(placementOf)],
        }
      : diagram,
  ),
});

/**
 * The placement of the element under the id on the first diagram placing
 * it, the object the model holds, throwing where no diagram places it.
 */
export const placementIn = (model: Model, id: string): Placement => {
  const placement = model.diagrams
    .map((diagram) => placementOn(diagram, elementId(id)))
    .find((candidate) => candidate !== undefined);
  if (!placement) {
    throw new Error(`Element ${id} is placed on no diagram.`);
  }
  return placement;
};

/** The flow under the id as it is drawn, throwing where the element is missing or no flow. */
export const flowIn = (model: Model, id: string): DrawnFlow => {
  const element = elementIn(model, id);
  if (element.kind !== 'flow') {
    throw new Error(`Element ${id} is not a flow.`);
  }
  return element;
};

/** The threat under the id, throwing where the register holds none. */
export const threatIn = (model: Model, id: string): Threat => {
  const threat = model.threats.find((candidate) => candidate.id === id);
  if (!threat) {
    throw new Error(`Threat ${id} is missing from the model.`);
  }
  return threat;
};
