import {
  escapedForTerminal,
  formatNameSchema,
  quotedForTerminal,
  type Divergence,
  type FormatName,
} from '@saerskriven/formats';
import type { Model } from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
import {
  namedModel,
  readModelFile,
  renderWorkspaceFailure,
  resultPath,
  type ModelWorkspace,
} from './workspace.js';

/**
 * One model as a read tool has it: the path a result names it by, the format
 * that claimed it, the handle a write quotes back, the model itself, and what
 * the file and the model do not correspond on.
 */
export type ModelReading = {
  readonly file: string;
  readonly format: FormatName;
  readonly revision: string;
  readonly model: Model;
  readonly divergences: readonly Divergence[];
};

/**
 * What every read and write tool reports about the file, `revision` being the
 * handle a write quotes back.
 */
export const readingSchema = z.object({
  file: z.string(),
  format: formatNameSchema,
  revision: z.string(),
});

/** What every read and write tool reports about the file. */
export type Reading = z.infer<typeof readingSchema>;

/**
 * The model a call names, or the default the server carries. A call naming
 * neither is refused, since `saer_inspect` is the tool that lists.
 */
export function readNamed(
  workspace: ModelWorkspace,
  file: string | undefined,
): Either.Either<ModelReading, readonly string[]> {
  const named = namedModel(workspace, file);
  return named === undefined
    ? Either.left(unnamed(workspace))
    : Either.mapBoth(readModelFile(named.workspace, named.file), {
        onLeft: renderWorkspaceFailure,
        onRight: (read) => ({
          file: resultPath(workspace, read.path),
          format: read.read.format,
          revision: read.revision,
          model: read.read.model,
          divergences: read.read.divergences,
        }),
      });
}

/** The reading's own fields, as the lines a read result opens with. */
export function renderReading(reading: Reading): readonly string[] {
  return [
    `file: ${escapedForTerminal(reading.file)}`,
    `format: ${reading.format}`,
    `revision: ${reading.revision}`,
  ];
}

/**
 * Foreign texts as one line of a text result lists them: each quoted as
 * {@link quotedForTerminal} quotes it and joined by commas, or `none` where
 * there are none.
 */
export function quotedList(texts: readonly string[]): string {
  return texts.length === 0 ? 'none' : texts.map(quotedForTerminal).join(', ');
}

/** The reading's own fields, as every read result of this server carries them. */
export function reportedReading(reading: ModelReading): Reading {
  return {
    file: reading.file,
    format: reading.format,
    revision: reading.revision,
  };
}

function unnamed(workspace: ModelWorkspace): readonly string[] {
  return [
    `No file was named and this server carries no default, so there is nothing to read under ${quotedForTerminal(workspace.root)}.`,
    'Name the model in the `file` argument. Calling saer_inspect with no argument lists the model files under the root.',
  ];
}
