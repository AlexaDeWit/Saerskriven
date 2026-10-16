import {
  escapedForTerminal,
  formatNameSchema,
  readLimits,
  retainedSource,
  saerskrivenYamlCodec,
  threatDragonCodec,
  undeclaredPaths,
  writeThrough,
  type DetectedRead,
  type Divergence,
  type FormatName,
  type ImportResult,
  type WriteResult,
} from '@saerskriven/formats';
import {
  overwrittenFile,
  WriteFailure,
  type OverwriteFailure,
} from '@saerskriven/mcp';
import type { Model } from '@saerskriven/model';
import { Either, pipe } from 'effect';
import { z } from 'zod';
import { danglingLink, resolved, sameFile } from './files.js';
import { describeDivergences, readConvertible } from './input.js';
import {
  delivered,
  invalidInput,
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
  dropUndeclared: z.boolean().optional(),
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
 * itself can be the output where the format stays the same. A file holding
 * keys this version cannot read is refused, writing nothing, unless
 * `dropUndeclared` drops them. What else the read and the write reported goes
 * to standard error, and none of it fails the command.
 */
export function convert(file: string, options: ConvertOptions): CommandOutcome {
  return Either.match(
    pipe(
      readConvertible(file),
      Either.flatMap((read) =>
        Either.map(rewritable(file, read, options), () => read),
      ),
      Either.flatMap((read) => droppable(file, read, options)),
    ),
    {
      onLeft: (outcome) => outcome,
      onRight: (dropping) => converted(dropping, options),
    },
  );
}

type ConvertedRead = DetectedRead | ImportResult;

type Dropping = {
  readonly read: ConvertedRead;
  readonly dropped: readonly string[];
};

function rewritable(
  file: string,
  read: ConvertedRead,
  options: ConvertOptions,
): Either.Either<void, CommandOutcome> {
  return options.out !== '-' &&
    read.format !== options.to &&
    sameFile(file, options.out)
    ? Either.left(
        usageError(
          lines(
            `error: --out names the file being converted, which only a conversion to its own format (${read.format}) may write over.`,
          ),
        ),
      )
    : Either.right(undefined);
}

function droppable(
  file: string,
  read: ConvertedRead,
  options: ConvertOptions,
): Either.Either<Dropping, CommandOutcome> {
  const dropped = undeclaredPaths(read.divergences);
  return dropped.length === 0 || options.dropUndeclared === true
    ? Either.right({ read, dropped })
    : Either.left(
        invalidInput(
          lines(
            `error: ${escapedForTerminal(file)} holds keys this version of saer cannot read, which the conversion would drop, so nothing was written:`,
            ...dropped.map(escapedForTerminal),
            'Upgrade saer to a release that reads them, or pass --drop-undeclared to write without them.',
          ),
        ),
      );
}

function converted(
  { read, dropped }: Dropping,
  options: ConvertOptions,
): CommandOutcome {
  const written = writtenAs(read, options.to);
  return delivered(
    options.out,
    written.output,
    describeDivergences([
      ...read.divergences.filter(notDropped),
      ...written.divergences,
    ]) + describeDropped(dropped),
    replaced,
  );
}

function notDropped(divergence: Divergence): boolean {
  return divergence.detail.code !== 'key-undeclared';
}

function describeDropped(dropped: readonly string[]): string {
  return dropped.length === 0
    ? ''
    : lines(
        'warning: dropped the keys this version of saer cannot read, as --drop-undeclared asks:',
        ...dropped.map(escapedForTerminal),
      );
}

function writtenAs(read: ConvertedRead, to: FormatName): WriteResult {
  return 'codec' in read && read.format === to
    ? writeThrough(read.model, retainedSource(read))
    : projections[to](read.model);
}

function replaced(
  path: string,
  text: string,
): Either.Either<string, readonly string[]> {
  return danglingLink(path)
    ? Either.left([
        `error: ${escapedForTerminal(path)} is a symbolic link to a file that is not there, so nothing was written.`,
      ])
    : Either.mapLeft(
        overwrittenFile(resolved({ file: path, path }), text),
        refusedWrite,
      );
}

function refusedWrite(failure: OverwriteFailure): readonly string[] {
  const file = escapedForTerminal(failure.file);
  return WriteFailure.$is('PastReadBound')(failure)
    ? [
        `error: ${file} was not written: the converted document is ${String(failure.size)} bytes, past the ${String(readLimits.maxTextBytes)} bytes Saerskriven reads.`,
      ]
    : [
        `error: cannot write ${file}: ${escapedForTerminal(withoutPath(failure.reason))}`,
      ];
}

function withoutPath(reason: string): string {
  return (
    /^(?<system>E[A-Z]+: [^,]*), \w+ '.*'$/u.exec(reason)?.groups?.['system'] ??
    reason
  );
}
