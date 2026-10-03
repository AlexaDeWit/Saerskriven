import type { Model } from '@saerskriven/model';
import { otmWireSchema, type OtmDocument } from '@saerskriven/wire-otm';
import { tmbomWireSchema, type TmbomDocument } from '@saerskriven/wire-tmbom';
import { Either } from 'effect';
import { z } from 'zod';
import { modelFrom, parseWire, ReadFailure } from './codec.js';
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
): Either.Either<ImportResult, ReadFailure> {
  return Either.flatMap(parseYaml(text), (given) =>
    Either.flatMap(importFormatOf(given), (format) => convert(format, given)),
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
): Either.Either<DetectedRead | ImportResult, ReadFailure | DetectionFailure> {
  return Either.orElse(readAnyFormat(text), (failure) =>
    DetectionFailure.$is('NoFormatClaimed')(failure)
      ? importNamed(text, failure)
      : Either.left(failure),
  );
}

function importFormatOf(
  given: unknown,
): Either.Either<ImportFormat, ReadFailure> {
  if (isRecord(given) && Object.hasOwn(given, 'otmVersion')) {
    return Either.right('otm');
  }
  if (isRecord(given) && Object.hasOwn(given, '$schema')) {
    return Either.right('tmbom');
  }
  return Either.left(
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
): Either.Either<ImportResult, ReadFailure | DetectionFailure> {
  const given = parseYaml(text);
  if (Either.isLeft(given)) {
    return Either.left(unclaimed);
  }
  const format = importFormatOf(given.right);
  return Either.isLeft(format)
    ? Either.left(unclaimed)
    : convert(format.right, given.right);
}

function convert(
  format: ImportFormat,
  given: unknown,
): Either.Either<ImportResult, ReadFailure> {
  const parsed: Either.Either<OtmDocument | TmbomDocument, ReadFailure> =
    format === 'otm'
      ? parseWire(otmWireSchema, given)
      : parseWire(tmbomWireSchema, given);
  if (Either.isLeft(parsed)) {
    return Either.left(parsed.left);
  }
  const source = parsed.right;
  const mapped = 'otmVersion' in source ? mapOtm(source) : mapTmbom(source);
  if (mapped.context.failure !== undefined) {
    return Either.left(mapped.context.failure);
  }
  if (mapped.context.issues.length > 0) {
    return Either.left(
      ReadFailure.InvalidWireDocument({ issues: mapped.context.issues }),
    );
  }
  const undeclared = undeclaredDivergences(
    given,
    source,
    mapped.context.reservePath,
  );
  if (mapped.context.failure !== undefined) {
    return Either.left(mapped.context.failure);
  }
  return Either.map(modelFrom(mapped.input), (model) => ({
    format,
    model,
    divergences: [...undeclared, ...mapped.context.divergences],
  }));
}
