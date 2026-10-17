import { Either } from 'effect';
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

type Origin = readonly [diagram: number, element: number];

/**
 * Parses a model whose diagrams own their elements, the shape a file format
 * with no shared elements reads into. Each element moves to the model's
 * root, in diagram order, and leaves its placement on the diagram that held
 * it, in the same order. Every issue's path points into `input`, whichever
 * check found it, so a refusal names the field as the input holds it.
 */
export function parseDrawnModel(
  input: unknown,
): Either.Either<Model, ParseFailure> {
  return Either.flatMap(
    Either.mapLeft(boundedParse(drawnModelSchema, input), (failure) =>
      ParseFailure.InvalidModel({ issues: schemaFailureIssues(failure) }),
    ),
    (drawn) => {
      const origins = drawn.diagrams.flatMap((diagram, diagramIndex) =>
        diagram.elements.map((_element, elementIndex): Origin => [
          diagramIndex,
          elementIndex,
        ]),
      );
      const placed = {
        ...drawn,
        elements: drawn.diagrams.flatMap((diagram) =>
          diagram.elements.map(elementOf),
        ),
        diagrams: drawn.diagrams.map(({ elements, ...diagram }) => ({
          ...diagram,
          placements: elements.map(placementOf),
        })),
      };
      return Either.mapLeft(parseModel(placed), ({ issues }) =>
        ParseFailure.InvalidModel({
          issues: issues.map((issue) => drawnIssue(issue, origins)),
        }),
      );
    },
  );
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
  return collection === 'diagrams' && field === 'placements'
    ? { ...issue, path: ['diagrams', index, 'elements', ...within.slice(1)] }
    : issue;
}
