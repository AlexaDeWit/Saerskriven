import { Result } from 'effect';
import type { z } from 'zod';
import { elementOf, placementOf } from './drawing.js';
import { drawnModelSchema } from './model.js';
import type { ParseIssue } from './parse-issue.js';
import {
  boundedParse,
  ParseFailure,
  parseModel,
  schemaFailureIssues,
  type Model,
} from './parse.js';
import {
  collectViolations,
  refusingViolations,
  type RelationshipScope,
} from './violations.js';

type DrawnModel = z.infer<typeof drawnModelSchema>;

type Origin = readonly [diagram: number, element: number];

const refinedDrawnSchema = (scope: RelationshipScope) =>
  refusingViolations(drawnModelSchema, (drawn) =>
    atDrawnPaths(collectViolations(placedFrom(drawn), scope), drawn.diagrams),
  );

const refinedDrawnSchemas = {
  model: refinedDrawnSchema('model'),
  diagram: refinedDrawnSchema('diagram'),
} as const;

/**
 * Parses a model whose diagrams own their elements, the shape a file format
 * with no shared elements reads into, and the entry point a read takes
 * before `parseModel`. Each element moves to the model's root, in diagram
 * order, and leaves its placement on the diagram that held it, in the same
 * order. Relationship lists resolve within `scope`, which each format's read
 * names for itself. The model's own rules run in the same pass as the
 * schema's, and every issue's path points into `input`, whichever check found
 * it, so a refusal names the field as the input holds it.
 */
export function parseDrawnModel(
  input: unknown,
  scope: RelationshipScope,
): Result.Result<Model, ParseFailure> {
  return Result.flatMap(
    Result.mapError(
      boundedParse(refinedDrawnSchemas[scope], input),
      (failure) =>
        ParseFailure.InvalidModel({ issues: schemaFailureIssues(failure) }),
    ),
    (drawn) =>
      Result.mapError(parseModel(placedFrom(drawn), scope), ({ issues }) =>
        ParseFailure.InvalidModel({
          issues: atDrawnPaths(issues, drawn.diagrams),
        }),
      ),
  );
}

function placedFrom(drawn: DrawnModel) {
  return {
    ...drawn,
    elements: drawn.diagrams.flatMap((diagram) =>
      diagram.elements.map(elementOf),
    ),
    diagrams: drawn.diagrams.map(({ elements, ...diagram }) => ({
      ...diagram,
      placements: elements.map(placementOf),
    })),
  };
}

/**
 * `issues`, found in a model split from `diagrams` as {@link parseDrawnModel}
 * splits one, at the paths `diagrams` holds them: an element of the model's
 * root at its place in the diagram that held it, and a placement at the
 * element it was split from. A flow end that holds no position where its
 * element is not placed points at the `element` a drawn end names.
 */
export function atDrawnPaths(
  issues: readonly ParseIssue[],
  diagrams: readonly { readonly elements: readonly unknown[] }[],
): ParseIssue[] {
  const origins = diagrams.flatMap((diagram, diagramIndex) =>
    diagram.elements.map((_element, elementIndex): Origin => [
      diagramIndex,
      elementIndex,
    ]),
  );
  return issues.map((issue) => drawnIssue(issue, origins));
}

function drawnIssue(issue: ParseIssue, origins: readonly Origin[]): ParseIssue {
  const [collection, index, field] = issue.path;
  const within = issue.path.slice(2);
  if (typeof index !== 'number') {
    return issue;
  }
  if (collection === 'elements') {
    const origin = origins.at(index);
    return origin === undefined
      ? issue
      : {
          ...issue,
          path: ['diagrams', origin[0], 'elements', origin[1], ...within],
        };
  }
  if (collection !== 'diagrams' || field !== 'placements') {
    return issue;
  }
  const drawnAt = ['diagrams', index, 'elements', ...within.slice(1)];
  return {
    ...issue,
    path:
      issue.detail.code === 'flow-endpoint-foreign'
        ? [...drawnAt, 'element']
        : drawnAt,
  };
}
