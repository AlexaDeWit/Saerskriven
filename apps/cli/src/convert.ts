import {
  escapedForTerminal,
  formatNameSchema,
  readLimits,
  saerskrivenYamlCodec,
  threatDragonCodec,
  type DetectedRead,
  type FormatName,
  type ImportResult,
  type WriteResult,
} from '@saerskriven/formats';
import {
  overwrittenFile,
  renderWriteFailure,
  serialized,
  WriteFailure,
  writtenThrough,
} from '@saerskriven/mcp';
import type { Model } from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
import { resolved } from './files.js';
import { describeDivergences, readConvertible } from './input.js';
import {
  delivered,
  lines,
  usageError,
  type CommandOutcome,
} from './outcome.js';

/** Validated arguments for the convert command. */
export const convertOptionsSchema = z.object({
  to: z.enum(formatNameSchema.options, {
    error: `must be ${formatNameSchema.options.join(' or ')}`,
  }),
  out: z.string({ error: 'must be a path, or - for standard output' }),
});

/** The options a conversion was asked for. */
export type ConvertOptions = z.infer<typeof convertOptionsSchema>;

const projections = {
  'saerskriven-yaml': (model) => saerskrivenYamlCodec.write(model),
  'threat-dragon': (model) => threatDragonCodec.write(model),
} satisfies Record<FormatName, (model: Model) => WriteResult>;

/**
 * `saer convert <file>`: the model written in the format `to` names. A file
 * already in that format is merged onto the document it was read from, so
 * what the model does not describe is kept. A file path is replaced through
 * a temporary file renamed onto the file a link there names, so the input
 * itself can be the output where the format stays the same. What the read
 * and the write reported goes to standard error, and neither fails the
 * command.
 */
export function convert(file: string, options: ConvertOptions): CommandOutcome {
  return Either.match(
    Either.flatMap(readConvertible(file), (read) =>
      Either.map(rewritable(file, read, options), () => read),
    ),
    {
      onLeft: (outcome) => outcome,
      onRight: (read) => converted(read, options),
    },
  );
}

type ConvertedRead = DetectedRead | ImportResult;

function rewritable(
  file: string,
  read: ConvertedRead,
  options: ConvertOptions,
): Either.Either<void, CommandOutcome> {
  return options.out !== '-' &&
    read.format !== options.to &&
    pathOf(file) === pathOf(options.out)
    ? Either.left(
        usageError(
          lines(
            `error: --out names the file being converted, which only a conversion to its own format (${read.format}) may write over.`,
          ),
        ),
      )
    : Either.right(undefined);
}

function converted(
  read: ConvertedRead,
  options: ConvertOptions,
): CommandOutcome {
  return Either.match(
    serialized(destinationOf(options.out), () => writtenAs(read, options.to)),
    {
      onLeft: (failure) => usageError(lines(...refusedWrite(failure))),
      onRight: (written) =>
        delivered(
          options.out,
          written.output,
          describeDivergences([...read.divergences, ...written.divergences]),
          replaced,
        ),
    },
  );
}

function writtenAs(read: ConvertedRead, to: FormatName): WriteResult {
  return 'codec' in read && read.format === to
    ? writtenThrough(read, read.model)
    : projections[to](read.model);
}

function replaced(
  path: string,
  text: string,
): Either.Either<string, readonly string[]> {
  return Either.mapLeft(
    overwrittenFile(resolved({ file: path, path }), text),
    refusedWrite,
  );
}

function refusedWrite(failure: WriteFailure): readonly string[] {
  if (WriteFailure.$is('PastReadBound')(failure)) {
    return [
      `error: ${failure.file} was not written: the converted document is ${String(failure.size)} bytes, past the ${String(readLimits.maxTextBytes)} bytes Saerskriven reads.`,
    ];
  }
  if (WriteFailure.$is('Unwritten')(failure)) {
    return [
      `error: cannot write ${failure.file}: ${escapedForTerminal(withoutPath(failure.reason))}`,
    ];
  }
  return renderWriteFailure(failure).map((line, index) =>
    index === 0 ? `error: ${line}` : line,
  );
}

function withoutPath(reason: string): string {
  return (
    /^(?<system>E[A-Z]+: [^,]*), \w+ '.*'$/u.exec(reason)?.groups?.['system'] ??
    reason
  );
}

function pathOf(file: string): string {
  return resolved({ file, path: file }).path;
}

function destinationOf(out: string): string {
  return out === '-' ? 'standard output' : out;
}
