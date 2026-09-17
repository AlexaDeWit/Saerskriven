import { Either } from 'effect';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { threatCategorySchema } from './lib/categories.js';
import type { Element, Flow } from './lib/elements.js';
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
import { parseModel, type Model } from './lib/parse.js';
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
export { validModelFixture } from './lib/model.fixtures.js';
export { modelInputArbitrary } from './lib/model-input.fixtures.js';
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
export function parsedFixture(input: unknown): Model {
  return Either.getOrThrowWith(
    parseModel(input),
    (failure) =>
      new Error(
        `Fixture does not parse: ${failure.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
      ),
  );
}

/** {@link validModelFixture}, parsed. */
export const validModel: Model = parsedFixture(validModelFixture);

/** {@link threatRegisterFixture}, parsed. */
export const registerModel: Model = parsedFixture(threatRegisterFixture);

/** {@link emptyRegisterFixture}, parsed. */
export const emptyRegisterModel: Model = parsedFixture(emptyRegisterFixture);

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
 * Reads and parses a committed model under `test-data`. The read happens at
 * the call, so importing this entry reads no file. A consumer lists the file
 * among its nx test inputs.
 */
export const committedModel = (name: string): Model =>
  parsedFixture(JSON.parse(committedText(name)));

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
];

/** The element of any diagram under the id, throwing where none is. */
export const elementIn = (model: Model, id: string): Element => {
  const element = model.diagrams
    .flatMap((diagram) => diagram.elements)
    .find((candidate) => candidate.id === id);
  if (!element) {
    throw new Error(`Element ${id} is missing from the model.`);
  }
  return element;
};

/** The flow under the id, throwing where the element is missing or no flow. */
export const flowIn = (model: Model, id: string): Flow => {
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
