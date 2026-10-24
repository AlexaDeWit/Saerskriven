import {
  escapedForTerminal,
  formatNameSchema,
  quotedForTerminal,
  writtenSaerskrivenYamlVersion,
  writtenSaerskrivenYamlVersionSchema,
  type Divergence,
  type FormatName,
} from '@saerskriven/formats';
import type { Model } from '@saerskriven/model';
import { Result } from 'effect';
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
  savesAsVersion: writtenSaerskrivenYamlVersionSchema
    .optional()
    .describe(
      'The Saerskriven YAML version a save of this model writes: 2 while version 2 holds the model, and 3 once it holds what version 2 cannot. A release that reads only versions 1 and 2 refuses a version 3 file. Absent for a Threat Dragon file.',
    ),
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
): Result.Result<ModelReading, readonly string[]> {
  const named = namedModel(workspace, file);
  return named === undefined
    ? Result.fail(unnamed(workspace))
    : Result.mapBoth(readModelFile(named.workspace, named.file), {
        onFailure: renderWorkspaceFailure,
        onSuccess: (read) => ({
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
    ...(reading.savesAsVersion === undefined
      ? []
      : [`saves as: version ${String(reading.savesAsVersion)}`]),
    `revision: ${reading.revision}`,
  ];
}

/**
 * The `savesAsVersion` a reading of `model` in `format` carries, and nothing
 * for a Threat Dragon file.
 */
export function savedVersion(
  format: FormatName,
  model: Model,
): Pick<Reading, 'savesAsVersion'> {
  return format === 'saerskriven-yaml'
    ? { savesAsVersion: writtenSaerskrivenYamlVersion(model) }
    : {};
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
    ...savedVersion(reading.format, reading.model),
    revision: reading.revision,
  };
}

function unnamed(workspace: ModelWorkspace): readonly string[] {
  return [
    `No file was named and this server carries no default, so there is nothing to read under ${quotedForTerminal(workspace.root)}.`,
    'Name the model in the `file` argument. Calling saer_inspect with no argument lists the model files under the root.',
  ];
}
