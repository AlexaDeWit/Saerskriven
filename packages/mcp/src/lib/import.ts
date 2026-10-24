import {
  escapedForTerminal,
  importFormatSchema,
  importModel,
  quotedForTerminal,
  renderReadFailure,
  writtenSaerskrivenYamlVersion,
} from '@saerskriven/formats';
import { Either, pipe } from 'effect';
import { z } from 'zod';
import { pathReach } from './path-arguments.js';
import {
  createdModel,
  movedToVersion3Lines,
  readBoundPhrase,
  renderWriteReport,
  writeReportSchema,
} from './write.js';
import {
  readTextFile,
  renderWorkspaceFailure,
  type ModelWorkspace,
} from './workspace.js';

/** What `saer_import` takes: the file to convert and where the model goes. */
export const importArgumentsSchema = z.object({
  file: z.string().describe(`The OTM or TM-BOM file to convert. ${pathReach}`),
  target: z
    .string()
    .describe(
      `Where to write the converted model. ${pathReach} The call is refused when a file is already there.`,
    ),
});

/** What `saer_import` takes. */
export type ImportArguments = z.infer<typeof importArgumentsSchema>;

/** What `saer_import` answers with. */
export const importResultSchema = writeReportSchema.extend({
  source: z.object({ file: z.string(), format: importFormatSchema }),
  movedToVersion3: z
    .boolean()
    .describe(
      'Whether the converted model was written as Saerskriven YAML version 3, because it holds what version 2 cannot, such as an element on more than one diagram. A release that reads only versions 1 and 2 refuses the file whole.',
    ),
});

/** What `saer_import` answers with. */
export type ImportResult = z.infer<typeof importResultSchema>;

/** What `saer_import` tells a client it is for. */
export const importDescription = [
  'Convert Open Threat Model (OTM) or TM-BOM into a new native YAML model.',
  '`file` is the source, `target` must not exist. Conversion is one-way: edit the new model, never the source.',
  'Every TM-BOM assumption applies to the model. TM-BOM threats without affected components also apply to the model. OTM threats without component or dataflow references attach to no element and do not apply to the model. Mitigations without threat links become model description prose.',
  'Writes YAML version 2 when possible, otherwise version 3, for example for shared elements. Older readers supporting only versions 1 and 2 refuse version 3. `movedToVersion3` reports a version 3 write.',
  'Review result divergences before relying on the conversion: undeclared keys, reduced values, mitigations kept as description prose and generated geometry.',
  `A converted model past ${readBoundPhrase}, is refused and not written, since the server could not open it again.`,
  'Use saer_inspect for Threat Dragon and Saerskriven files. They need no conversion and support edits in place.',
].join(' ');

/** Convert into a new model without replacing an existing target. */
export function importIntoModel(
  workspace: ModelWorkspace,
  args: ImportArguments,
): Either.Either<ImportResult, readonly string[]> {
  return pipe(
    readTextFile(workspace, args.file),
    Either.mapLeft(renderWorkspaceFailure),
    Either.flatMap((source) =>
      Either.mapLeft(importModel(source.text), (failure) => [
        `The file ${quotedForTerminal(args.file)} was not converted.`,
        ...renderReadFailure(failure),
      ]),
    ),
    Either.flatMap((imported) =>
      Either.map(
        createdModel(
          workspace,
          args.target,
          imported.model,
          imported.divergences,
        ),
        (report): ImportResult => ({
          ...report,
          source: { file: args.file, format: imported.format },
          movedToVersion3: writtenSaerskrivenYamlVersion(imported.model) === 3,
        }),
      ),
    ),
  );
}

/** The converted model as the lines its text result carries. */
export function renderImport(result: ImportResult): readonly string[] {
  return [
    `converted: ${escapedForTerminal(result.source.file)} (${result.source.format})`,
    ...movedToVersion3Lines(result.movedToVersion3),
    ...renderWriteReport(result),
  ];
}
