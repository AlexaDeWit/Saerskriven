import { Either } from 'effect';
import { ReadFailure } from './codec.js';
import { parseWithinLimits } from './read-limits.js';

/** JSON parsed within the shared byte and nesting limits. */
export function parseJson(text: string): Either.Either<unknown, ReadFailure> {
  return parseWithinLimits(text, (bounded) =>
    Either.try({
      try: () => JSON.parse(bounded) as unknown,
      catch: (error) => ReadFailure.MalformedText({ message: String(error) }),
    }),
  );
}
