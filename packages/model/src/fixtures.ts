import { Either } from 'effect';
import type { z } from 'zod';
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

export { validModelFixture } from './lib/fixtures.js';
export { modelInputArbitrary } from './lib/model-input.fixtures.js';
export {
  securityModelFixture,
  securityPropertyFixtures,
} from './lib/security.fixtures.js';

const parsing =
  <Schema extends z.ZodType>(schema: Schema) =>
  (value: string): z.infer<Schema> =>
    schema.parse(value);

/** Parses a spec's literal string into a branded element id. */
export const elementId: (value: string) => ElementId = parsing(elementIdSchema);

/** Parses a spec's literal string into a branded diagram id. */
export const diagramId: (value: string) => DiagramId = parsing(diagramIdSchema);

/** Parses a spec's literal string into a branded threat id. */
export const threatId: (value: string) => ThreatId = parsing(threatIdSchema);

/** Parses a spec's literal string into a branded mitigation id. */
export const mitigationId: (value: string) => MitigationId =
  parsing(mitigationIdSchema);

/** Parses a spec's literal string into a branded assumption id. */
export const assumptionId: (value: string) => AssumptionId =
  parsing(assumptionIdSchema);

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
