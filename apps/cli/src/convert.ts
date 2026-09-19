import {
  formatNameSchema,
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
  writtenThrough,
} from '@saerskriven/mcp';
import type { Model } from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
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
 * a temporary file renamed onto it, so the input itself can be the output.
 * What the read and the write reported goes to standard error, and neither
 * fails the command.
 */
export function convert(file: string, options: ConvertOptions): CommandOutcome {
  return Either.match(readConvertible(file), {
    onLeft: (outcome) => outcome,
    onRight: (read) => converted(read, options),
  });
}

function converted(
  read: DetectedRead | ImportResult,
  options: ConvertOptions,
): CommandOutcome {
  return Either.match(
    serialized(options.out, () => writtenAs(read, options.to)),
    {
      onLeft: (failure) => usageError(lines(...renderWriteFailure(failure))),
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

function writtenAs(
  read: DetectedRead | ImportResult,
  to: FormatName,
): WriteResult {
  return 'codec' in read && read.format === to
    ? writtenThrough(read, read.model)
    : projections[to](read.model);
}

function replaced(
  path: string,
  text: string,
): Either.Either<string, readonly string[]> {
  return Either.mapLeft(
    overwrittenFile({ file: path, path }, text),
    renderWriteFailure,
  );
}
