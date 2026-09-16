import { withinTextBytes } from '@saerskriven/formats';
import { reasonOf } from '@saerskriven/mcp';
import { Either } from 'effect';
import { readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';

/** A file as UTF-8 text, or a sentence naming the path and the system's reason. */
export function readTextFile(path: string): Either.Either<string, string> {
  return Either.try({
    try: () => readFileSync(path, 'utf8'),
    catch: (error) => `cannot read ${path}: ${reasonOf(error)}`,
  });
}

/**
 * Nothing where the path is inside the shared read bound, or the caller's own
 * refusal carrying the size measured where it is past it. A size that cannot
 * be measured passes, leaving the read that follows to say why.
 */
export function withinReadBound<Failure>(
  path: string,
  refusal: (observed: number) => Failure,
): Either.Either<void, Failure> {
  const size = sizeOf(path);
  return size === undefined || withinTextBytes(size)
    ? Either.right(undefined)
    : Either.left(refusal(size));
}

/**
 * The content written to a path, text as UTF-8 and bytes as they are, or a
 * sentence naming the path and the system's reason.
 */
export function writeFile(
  path: string,
  content: string | Uint8Array,
): Either.Either<void, string> {
  return Either.try({
    try: () => {
      writeFileSync(path, content);
    },
    catch: (error) => `cannot write ${path}: ${reasonOf(error)}`,
  });
}

/**
 * The text written to a new file only its owner can read, after removing
 * whatever was at the path. A symbolic link there is removed itself, so the
 * text never lands in the file it pointed at.
 */
export function createPrivateFile(
  path: string,
  text: string,
): Either.Either<void, string> {
  return Either.try({
    try: () => {
      rmSync(path, { force: true });
      writeFileSync(path, text, { flag: 'wx', mode: 0o600 });
    },
    catch: (error) => `cannot write ${path}: ${reasonOf(error)}`,
  });
}

function sizeOf(path: string): number | undefined {
  return Either.getOrUndefined(Either.try(() => statSync(path).size));
}
