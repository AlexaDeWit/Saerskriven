import {
  DetectionFailure,
  exceededReadLimit,
  hasDiverged,
  importFormatOf,
  importModel,
  parseYaml,
  readAnyFormat,
  renderDivergences,
  renderReadFailure,
  type DetectedRead,
  type Divergence,
  type ImportResult,
  type ReadFailure,
} from '@saerskriven/formats';
import { Either } from 'effect';
import { readTextFile, withinReadBound } from './files.js';
import {
  invalidInput,
  lines,
  usageError,
  type CommandOutcome,
} from './outcome.js';

/**
 * The file read as whichever format claims its content, or the outcome the
 * edge reports instead. An unreadable path exits 2, and a text no codec
 * claims, past a read bound, or refused by its codec exits 1.
 */
export function readModel(
  file: string,
): Either.Either<DetectedRead, CommandOutcome> {
  return readWith(file, readAnyFormat);
}

/**
 * The file read as {@link readModel} reads it, or converted from OTM or
 * TM-BOM where no codec claims it and its root names one of those formats.
 */
export function readConvertible(
  file: string,
): Either.Either<DetectedRead | ImportResult, CommandOutcome> {
  return readWith(file, (text) =>
    Either.orElse(readAnyFormat(text), (failure) =>
      DetectionFailure.$is('NoFormatClaimed')(failure) &&
      namesImportFormat(text)
        ? importModel(text)
        : Either.left(failure),
    ),
  );
}

/**
 * The divergences a read recorded, as a warning, and nothing at all where
 * the file and the model correspond exactly. A divergence is not a failure:
 * the file was read, and this says what the reading cost.
 */
export function describeDivergences(
  divergences: readonly Divergence[],
): string {
  return hasDiverged(divergences)
    ? lines(
        'warning: the file and the model do not correspond exactly.',
        renderDivergences(divergences),
      )
    : '';
}

function readWith<Read>(
  file: string,
  read: (text: string) => Either.Either<Read, ReadFailure | DetectionFailure>,
): Either.Either<Read, CommandOutcome> {
  return Either.flatMap(withinSizeBound(file), () =>
    Either.match(readTextFile(file), {
      onLeft: (reason) => Either.left(usageError(lines(`error: ${reason}`))),
      onRight: (text) =>
        Either.mapLeft(read(text), (failure) =>
          invalidInput(describeReadFailure(failure)),
        ),
    }),
  );
}

function withinSizeBound(file: string): Either.Either<void, CommandOutcome> {
  return withinReadBound(file, (observed) =>
    invalidInput(
      describeReadFailure(exceededReadLimit('maxTextBytes', observed)),
    ),
  );
}

function namesImportFormat(text: string): boolean {
  return Either.isRight(Either.flatMap(parseYaml(text), importFormatOf));
}

function describeReadFailure(failure: ReadFailure | DetectionFailure): string {
  return lines(...renderReadFailure(failure));
}
