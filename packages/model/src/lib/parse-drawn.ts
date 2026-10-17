import { Either } from 'effect';
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
import { collectViolations, refusingViolations } from './violations.js';

type DrawnModel = z.infer<typeof drawnModelSchema>;

type Origin = readonly [diagram: number, element: number];

const refinedDrawnModelSchema = refusingViolations(
  drawnModelSchema,
  (drawn) => {
    const origins = originsOf(drawn);
    return collectViolations(placedFrom(drawn)).map((issue) =>
      drawnIssue(issue, origins),
    );
  },
);

/**
 * Parses a model whose diagrams own their elements, the shape a file format
 * with no shared elements reads into, and the entry point a read takes
 * before `parseModel`. Each element moves to the model's root, in diagram
 * order, and leaves its placement on the diagram that held it, in the same
 * order. The model's own rules run in the same pass as the schema's, and
 * every issue's path points into `input`, whichever check found it, so a
 * refusal names the field as the input holds it.
 */
export function parseDrawnModel(
  input: unknown,
): Either.Either<Model, ParseFailure> {
  return Either.flatMap(
    Either.mapLeft(boundedParse(refinedDrawnModelSchema, input), (failure) =>
      ParseFailure.InvalidModel({ issues: schemaFailureIssues(failure) }),
    ),
    (drawn) => {
      const origins = originsOf(drawn);
      return Either.mapLeft(parseModel(placedFrom(drawn)), ({ issues }) =>
        ParseFailure.InvalidModel({
          issues: issues.map((issue) => drawnIssue(issue, origins)),
        }),
      );
    },
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

function originsOf(drawn: DrawnModel): readonly Origin[] {
  return drawn.diagrams.flatMap((diagram, diagramIndex) =>
    diagram.elements.map((_element, elementIndex): Origin => [
      diagramIndex,
      elementIndex,
    ]),
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
