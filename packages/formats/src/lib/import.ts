import type { Model } from '@saerskriven/model';
import { otmWireSchema } from '@saerskriven/wire-otm';
import { tmbomWireSchema } from '@saerskriven/wire-tmbom';
import { Either } from 'effect';
import { z } from 'zod';
import { modelFrom, ReadFailure, refusedWireDocument } from './codec.js';
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
          code: 'invalid_format',
          message:
            'Import requires an OTM 0.2.0 version stamp or a TM-BOM 1.0.1 or 1.0.2 schema URI.',
        },
      ],
    }),
  );
}

function convert(
  format: ImportFormat,
  given: unknown,
): Either.Either<ImportResult, ReadFailure> {
  const parsed =
    format === 'otm'
      ? otmWireSchema.safeParse(given)
      : tmbomWireSchema.safeParse(given);
  if (!parsed.success) {
    return Either.left(refusedWireDocument(parsed.error.issues));
  }
  const source = parsed.data;
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
