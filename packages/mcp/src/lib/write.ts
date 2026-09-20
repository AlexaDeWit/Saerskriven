import {
  divergenceSchema,
  escapedForTerminal,
  quotedForTerminal,
  readLimits,
  renderDivergences,
  saerskrivenYamlCodec,
  withinTextBytes,
  type DetectedRead,
  type Divergence,
  type WriteResult,
} from '@saerskriven/formats';
import type { Model } from '@saerskriven/model';
import { Data, Either, pipe } from 'effect';
import { randomUUID } from 'node:crypto';
import {
  chmodSync,
  linkSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { z } from 'zod';
import { fileArgumentSchema } from './inspect.js';
import { readingSchema, renderReading } from './reading.js';
import { revisionOf } from './revision.js';
import {
  confined,
  reasonOf,
  renderWorkspaceFailure,
  withinRoot,
  type ModelWorkspace,
  type ReadModelFile,
} from './workspace.js';

/**
 * Why a write produced no file, in the order a tool reaches the checks.
 * `StaleRevision` is answered by reading the file again rather than by
 * retrying. `PastReadBound` keeps every file this server writes one it can
 * read again.
 */
export type WriteFailure = Data.TaggedEnum<{
  NoFile: { readonly root: string };
  StaleRevision: {
    readonly file: string;
    readonly quoted: string;
    readonly found: string;
  };
  Occupied: { readonly file: string };
  PastReadBound: { readonly file: string; readonly size: number };
  Unwritten: { readonly file: string; readonly reason: string };
}>;

/**
 * Constructors for {@link WriteFailure}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const WriteFailure = Data.taggedEnum<WriteFailure>();

/** The two ways {@link overwrittenFile} can refuse, which check no revision. */
export type OverwriteFailure = Extract<
  WriteFailure,
  { readonly _tag: 'PastReadBound' | 'Unwritten' }
>;

type Unwritten = Extract<WriteFailure, { readonly _tag: 'Unwritten' }>;

/** Where a write is going: the spelling a result names, and the path on disk. */
export type WriteTarget = {
  readonly file: string;
  readonly path: string;
};

/**
 * The `revision` a write quotes back, beside the `file` argument every tool
 * of this server takes.
 */
export const revisionArgumentSchema = fileArgumentSchema.extend({
  revision: z
    .string()
    .describe(
      'The revision handle the last read of this file returned. The write is refused when the file no longer hashes to it, checked when this call reads the file and again immediately before the file is replaced, which means something else wrote the file and the edit has to be reconsidered against what it holds now. The second check is not a lock: a save landing between it and the replacement is still overwritten.',
    ),
});

/** What every write tool reports about the file it produced. */
export const writeReportSchema = readingSchema.extend({
  divergences: z.array(divergenceSchema),
});

/** What every write tool reports about the file it produced. */
export type WriteReport = z.infer<typeof writeReportSchema>;

/** The size bound a write tool's description names, in MiB. */
export const readBoundPhrase = `${String(readLimits.maxTextBytes / 1_048_576)} MiB, the size this server reads`;

/** The file a write produced, as the lines its text result carries. */
export function renderWriteReport(report: WriteReport): readonly string[] {
  return [
    ...renderReading(report),
    'divergences:',
    renderDivergences(report.divergences),
  ];
}

/**
 * `model` as a new native YAML file at the path a call names, refused where
 * the path is outside the root or taken. `carried` divergences come before
 * the codec's own.
 */
export function createdModel(
  workspace: ModelWorkspace,
  requested: string,
  model: Model,
  carried: readonly Divergence[],
): Either.Either<WriteReport, readonly string[]> {
  return pipe(
    confined(workspace, requested),
    Either.mapLeft(renderWorkspaceFailure),
    Either.flatMap((path) => {
      const file = withinRoot(workspace, path);
      return pipe(
        serialized(file, () => saerskrivenYamlCodec.write(model)),
        Either.flatMap((written) =>
          Either.map(
            createdFile({ file, path }, written.output),
            (revision): WriteReport => ({
              file,
              format: 'saerskriven-yaml',
              revision,
              divergences: [...carried, ...written.divergences],
            }),
          ),
        ),
        Either.mapLeft(renderWriteFailure),
      );
    }),
  );
}

/** Why nothing was written, as the lines a refused tool result carries. */
export function renderWriteFailure(failure: WriteFailure): readonly string[] {
  return WriteFailure.$match(failure, {
    NoFile: ({ root }) => [
      `No file was named and this server carries no default, so there is nothing to write under ${quotedForTerminal(root)}.`,
      'Name the file to write in the `file` argument.',
    ],
    StaleRevision: ({ file, quoted, found }) => [
      `The file ${quotedForTerminal(file)} changed since the read this call quoted, so nothing was written.`,
      `The call quoted ${quotedForTerminal(quoted)}, and the file on disk is ${found}.`,
      'Read the file again and reconsider the edit against what it holds now.',
    ],
    Occupied: ({ file }) => [
      `The file ${quotedForTerminal(file)} is already there, and this tool writes only a path that is free.`,
    ],
    PastReadBound: ({ file, size }) => [
      `The file ${quotedForTerminal(file)} was not written: what this call would write is ${String(size)} bytes, past the size this server reads (${String(readLimits.maxTextBytes)} bytes), so the server could not open it again.`,
      'Whatever the path held before is unchanged. The file has to stay within that size, so write less into it: a smaller change for an edit, a smaller source for an import.',
    ],
    Unwritten: ({ file, reason }) => [
      `The file ${quotedForTerminal(file)} was not written: ${escapedForTerminal(reason)}.`,
    ],
  });
}

/** The file a call names, or the default the server carries. */
export function namedFile(
  workspace: ModelWorkspace,
  file: string | undefined,
): Either.Either<string, WriteFailure> {
  const named = file ?? workspace.defaultFile;
  return named === undefined
    ? Either.left(WriteFailure.NoFile({ root: workspace.root }))
    : Either.right(named);
}

/**
 * The read a write may go on from, refused where the bytes this call read no
 * longer hash to the revision it quoted. {@link replacedFile} checks the
 * handle a second time.
 */
export function unchangedSince(
  file: string,
  revision: string,
  read: ReadModelFile,
): Either.Either<ReadModelFile, WriteFailure> {
  return Either.map(staleUnless(file, revision, read.revision), () => read);
}

/**
 * `text` in place of what `target` holds, through a temporary file renamed
 * onto it, carrying the target's mode (or `created` where there is none) and
 * answering with the new revision. The target is hashed again just before the
 * rename and refused as `StaleRevision` where it no longer matches `quoted`,
 * or as `Unwritten` where it cannot be hashed. That check is not a lock: a
 * save landing between it and the rename is still replaced.
 */
export function replacedFile(
  target: WriteTarget,
  text: string,
  quoted: string,
  created?: number,
): Either.Either<string, WriteFailure> {
  return Either.flatMap(readableBytes(target, text), (bytes) =>
    throughTemporary(
      target,
      bytes,
      (temporary) =>
        Either.flatMap(unmovedSince(target, quoted), () =>
          renamedOnto(target, temporary),
        ),
      created,
    ),
  );
}

/**
 * `text` in place of whatever `target` holds, or as a new file where it holds
 * nothing, through a temporary file renamed onto it. It is {@link
 * replacedFile} with no revision checked: an MCP tool uses `replacedFile`,
 * and this is for a writer that never read the target.
 */
export function overwrittenFile(
  target: WriteTarget,
  text: string,
): Either.Either<string, OverwriteFailure> {
  return Either.flatMap(readableBytes(target, text), (bytes) =>
    throughTemporary(target, bytes, (temporary) =>
      renamedOnto(target, temporary),
    ),
  );
}

/**
 * {@link createdBytes} for a text, which is what a codec produces, refused as
 * `PastReadBound` where the text is past the size this server reads.
 */
export function createdFile(
  target: WriteTarget,
  text: string,
  created?: number,
): Either.Either<string, WriteFailure> {
  return Either.flatMap(readableBytes(target, text), (bytes) =>
    createdBytes(target, bytes, created),
  );
}

/**
 * `bytes` as a new file at `target` with the mode `created`, refused as
 * `Occupied` where the path is taken. The temporary file is linked rather
 * than renamed onto the target, so the refusal and the write are one atomic
 * step.
 */
export function createdBytes(
  target: WriteTarget,
  bytes: Uint8Array,
  created?: number,
): Either.Either<string, WriteFailure> {
  return throughTemporary(
    target,
    bytes,
    (temporary) =>
      Either.try({
        try: () => {
          linkSync(temporary, target.path);
        },
        catch: (error) => occupiedOrUnwritten(target.file, error),
      }),
    created,
  );
}

/**
 * What a serializer produced, or `Unwritten` where it threw. Codecs and
 * third-party writers answer with text rather than a result union, and a
 * throw reaching the transport would lose the tool result.
 */
export function serialized<Value>(
  file: string,
  write: () => Value,
): Either.Either<Value, WriteFailure> {
  return Either.try({
    try: write,
    catch: (error) => unwritten(file, error),
  });
}

/**
 * The model through the codec that read the file, merged onto the document
 * that read produced. The two identical branches narrow the detected read so
 * each codec receives its own format's source document.
 */
export function writtenThrough(read: DetectedRead, model: Model): WriteResult {
  return read.format === 'threat-dragon'
    ? read.codec.write(model, read.source)
    : read.codec.write(model, read.source);
}

const errnoSchema = z.object({ code: z.string() });

function readableBytes(
  target: WriteTarget,
  text: string,
): Either.Either<Buffer, OverwriteFailure> {
  const bytes = Buffer.from(text, 'utf8');
  return withinTextBytes(bytes.length)
    ? Either.right(bytes)
    : Either.left(
        WriteFailure.PastReadBound({ file: target.file, size: bytes.length }),
      );
}

function throughTemporary<Failure extends WriteFailure>(
  target: WriteTarget,
  bytes: Uint8Array,
  commit: (temporary: string) => Either.Either<void, Failure>,
  created?: number,
): Either.Either<string, Failure | Unwritten> {
  const temporary = join(
    dirname(target.path),
    `.${basename(target.path)}.${randomUUID()}.saer`,
  );
  return discarding(
    temporary,
    Either.flatMap(
      Either.flatMap(staged(target, temporary, bytes, created), () =>
        commit(temporary),
      ),
      () =>
        Either.try({
          try: () => revisionOf(bytes),
          catch: (error) => unwritten(target.file, error),
        }),
    ),
  );
}

function staged(
  target: WriteTarget,
  temporary: string,
  bytes: Uint8Array,
  created?: number,
): Either.Either<void, Unwritten> {
  const mode = modeOf(target.path) ?? created;
  return Either.try({
    try: () => {
      writeFileSync(
        temporary,
        bytes,
        mode === undefined ? undefined : { mode },
      );
      if (mode !== undefined) {
        chmodSync(temporary, mode);
      }
    },
    catch: (error) => unwritten(target.file, error),
  });
}

function renamedOnto(
  target: WriteTarget,
  temporary: string,
): Either.Either<void, Unwritten> {
  return Either.try({
    try: () => {
      renameSync(temporary, target.path);
    },
    catch: (error) => unwritten(target.file, error),
  });
}

function unmovedSince(
  target: WriteTarget,
  quoted: string,
): Either.Either<void, WriteFailure> {
  return Either.flatMap(rehashed(target), (found) =>
    staleUnless(target.file, quoted, found),
  );
}

function rehashed(target: WriteTarget): Either.Either<string, WriteFailure> {
  return Either.flatMap(
    Either.try({
      try: () => statSync(target.path).size,
      catch: (error) => unwritten(target.file, error),
    }),
    (size) =>
      withinTextBytes(size)
        ? Either.try({
            try: () => revisionOf(readFileSync(target.path)),
            catch: (error) => unwritten(target.file, error),
          })
        : Either.left(
            WriteFailure.Unwritten({
              file: target.file,
              reason: `it is now ${String(size)} bytes, past the ${String(readLimits.maxTextBytes)} this server reads`,
            }),
          ),
  );
}

function staleUnless(
  file: string,
  quoted: string,
  found: string,
): Either.Either<void, WriteFailure> {
  return quoted === found
    ? Either.right(undefined)
    : Either.left(WriteFailure.StaleRevision({ file, quoted, found }));
}

function discarding<Outcome>(temporary: string, outcome: Outcome): Outcome {
  return Either.match(
    Either.try(() => {
      rmSync(temporary, { force: true });
    }),
    { onLeft: () => outcome, onRight: () => outcome },
  );
}

function modeOf(path: string): number | undefined {
  return Either.getOrUndefined(Either.try(() => statSync(path).mode & 0o777));
}

function unwritten(file: string, error: unknown): Unwritten {
  return WriteFailure.Unwritten({ file, reason: reasonOf(error) });
}

function occupiedOrUnwritten(file: string, error: unknown): WriteFailure {
  const errno = errnoSchema.safeParse(error);
  return errno.success && errno.data.code === 'EEXIST'
    ? WriteFailure.Occupied({ file })
    : unwritten(file, error);
}
