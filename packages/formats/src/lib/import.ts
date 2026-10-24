import type { Model } from '@saerskriven/model';
import { otmWireSchema, type OtmDocument } from '@saerskriven/wire-otm';
import { tmbomWireSchema, type TmbomDocument } from '@saerskriven/wire-tmbom';
import { Result } from 'effect';
import { z } from 'zod';
import { parseWire, ReadFailure } from './codec.js';
import {
  DetectionFailure,
  readAnyFormat,
  type DetectedRead,
} from './detect.js';
import type { Divergence } from './divergence.js';
import { mapOtm } from './otm-import.js';
import { parseYaml } from './parse-yaml.js';
import { isRecord } from './records.js';
import { mapTmbom } from './tmbom-import.js';
import { undeclaredDivergences } from './undeclared.js';

/** The formats an import converts into a new native model. */
export const importFormatSchema = z.enum(['otm', 'tmbom']);

/** A format an import reads and no codec writes. */
export type ImportFormat = z.infer<typeof importFormatSchema>;

/** A converted model, with no source document kept for a later save. */
export type ImportResult = {
  readonly format: ImportFormat;
  readonly model: Model;
  readonly divergences: readonly Divergence[];
};

/**
 * A complete OTM or TM-BOM document as a native model, told apart by an
 * `otmVersion` or a `$schema` key at the root.
 */
export function importModel(
  text: string,
): Result.Result<ImportResult, ReadFailure> {
  return Result.flatMap(parseYaml(text), (given) =>
    Result.flatMap(importFormatOf(given), (format) => convert(format, given)),
  );
}

/**
 * A text read by whichever codec claims it, as {@link readAnyFormat} reads
 * it, or converted as {@link importModel} converts it where no codec claims
 * it and its root names OTM or TM-BOM. Any other text no codec claims keeps
 * the detection failure, which names the codec formats tried.
 */
export function readOrImport(
  text: string,
): Result.Result<DetectedRead | ImportResult, ReadFailure | DetectionFailure> {
  return Result.orElse(readAnyFormat(text), (failure) =>
    DetectionFailure.$is('NoFormatClaimed')(failure)
      ? importNamed(text, failure)
      : Result.fail(failure),
  );
}

function importFormatOf(
  given: unknown,
): Result.Result<ImportFormat, ReadFailure> {
  if (isRecord(given) && Object.hasOwn(given, 'otmVersion')) {
    return Result.succeed('otm');
  }
  if (isRecord(given) && Object.hasOwn(given, '$schema')) {
    return Result.succeed('tmbom');
  }
  return Result.fail(
    ReadFailure.InvalidWireDocument({
      issues: [
        {
          path: [],
          detail: { code: 'import-format-unnamed', parameters: releasesRead },
        },
      ],
    }),
  );
}

const schemaReleaseMark = '/blob/v';

const releasesRead = {
  otm: [otmWireSchema.shape.otmVersion.value],
  tmbom: tmbomWireSchema.options.map((option) =>
    releaseNamedBy(option.shape.$schema.value),
  ),
};

function releaseNamedBy(schemaUri: string): string {
  const start = schemaUri.indexOf(schemaReleaseMark) + schemaReleaseMark.length;
  return schemaUri.slice(start, schemaUri.indexOf('/', start));
}

function importNamed(
  text: string,
  unclaimed: DetectionFailure,
): Result.Result<ImportResult, ReadFailure | DetectionFailure> {
  const given = parseYaml(text);
  if (Result.isFailure(given)) {
    return Result.fail(unclaimed);
  }
  const format = importFormatOf(given.success);
  return Result.isFailure(format)
    ? Result.fail(unclaimed)
    : convert(format.success, given.success);
}

function convert(
  format: ImportFormat,
  given: unknown,
): Result.Result<ImportResult, ReadFailure> {
  const parsed: Result.Result<OtmDocument | TmbomDocument, ReadFailure> =
    format === 'otm'
      ? parseWire(otmWireSchema, given)
      : parseWire(tmbomWireSchema, given);
  if (Result.isFailure(parsed)) {
    return Result.fail(parsed.failure);
  }
  const source = parsed.success;
  const mapped = 'otmVersion' in source ? mapOtm(source) : mapTmbom(source);
  if (mapped.context.failure !== undefined) {
    return Result.fail(mapped.context.failure);
  }
  if (mapped.context.issues.length > 0) {
    return Result.fail(
      ReadFailure.InvalidWireDocument({ issues: mapped.context.issues }),
    );
  }
  const undeclared = undeclaredDivergences(
    given,
    source,
    mapped.context.reservePath,
  );
  if (mapped.context.failure !== undefined) {
    return Result.fail(mapped.context.failure);
  }
  return Result.map(mapped.model(), (model) => ({
    format,
    model,
    divergences: [...undeclared, ...mapped.context.divergences],
  }));
}
