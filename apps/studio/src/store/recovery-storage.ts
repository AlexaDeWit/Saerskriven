import {
  ReadFailure,
  currentSaerskrivenYaml,
  parseWithinLimits,
  readSaerskrivenYamlDocument,
  saerskrivenYamlVersionsSchema,
  threatDragonCodec,
  withinTextLimit,
  writeSaerskrivenYamlDocument,
} from '@saerskriven/formats';
import {
  boundedParse,
  diagramIdSchema,
  SchemaFailure,
  type DiagramId,
  type Model,
} from '@saerskriven/model';
import { Data, Either } from 'effect';
import { z } from 'zod';
import { reasonOf } from '../reason.js';
import { studioVersion } from '../version.js';
import { holdsDiagram } from './selectors.js';
import {
  FileLifecycle,
  initialState,
  type RetainedSource,
  type State,
} from './state.js';

const recoveryVersion = 2;

/** The browser key that holds the current working session. */
export const recoveryStorageKey = 'saerskriven:studio:recovery';

const documentSchema = saerskrivenYamlVersionsSchema.transform(
  (document, context): Model => {
    const model = readSaerskrivenYamlDocument(document);
    if (Either.isLeft(model)) {
      context.addIssue({ code: 'custom', message: 'Invalid stored model.' });
      return z.NEVER;
    }
    return model.right;
  },
);

const retainedSourceSchema = z
  .discriminatedUnion('format', [
    z.object({
      format: z.literal('threat-dragon'),
      document: threatDragonCodec.wire.optional(),
    }),
    z.object({
      format: z.literal('saerskriven-yaml'),
      document: saerskrivenYamlVersionsSchema
        .transform((document) => currentSaerskrivenYaml(document).document)
        .optional(),
    }),
  ])
  .transform((source): RetainedSource =>
    source.format === 'threat-dragon'
      ? { format: 'threat-dragon', document: source.document }
      : { format: 'saerskriven-yaml', document: source.document },
  );

const fileLifecycleSchema = z
  .discriminatedUnion('_tag', [
    z.object({ _tag: z.literal('NoFile') }),
    z.object({
      _tag: z.literal('Opened'),
      name: z.string(),
      source: retainedSourceSchema,
    }),
  ])
  .transform((file): FileLifecycle =>
    file._tag === 'NoFile'
      ? FileLifecycle.NoFile()
      : FileLifecycle.Opened({ name: file.name, source: file.source }),
  );

/**
 * The versioned value stored for recovery. `document` is stored as a
 * Saerskriven YAML wire document and parses to the model as `present`.
 */
export const recoverySnapshotSchema = z
  .object({
    version: z.literal(recoveryVersion),
    document: documentSchema,
    writtenBy: z.object({ studioVersion: z.string() }),
    dirty: z.boolean(),
    file: fileLifecycleSchema,
    activeDiagram: diagramIdSchema.optional(),
  })
  .transform(({ document, ...rest }) => ({ ...rest, present: document }));

/** A validated session recovery snapshot. */
export type RecoverySnapshot = z.output<typeof recoverySnapshotSchema>;

/** A snapshot as recovery storage holds it, before the document is mapped. */
export type StoredSnapshot = z.input<typeof recoverySnapshotSchema>;

/** Builds the current recovery version from store data. */
export function recoverySnapshot(
  present: Model,
  dirty: boolean,
  file: FileLifecycle,
  activeDiagram?: DiagramId,
): StoredSnapshot {
  return {
    version: recoveryVersion,
    document: writeSaerskrivenYamlDocument(present),
    writtenBy: { studioVersion },
    dirty,
    file,
    ...(activeDiagram === undefined ? {} : { activeDiagram }),
  };
}

/**
 * The state a snapshot restores, with empty history and transient state. A
 * dirty snapshot gets a copy as its saved model, since dirty is identity.
 */
export function restoredState(snapshot: RecoverySnapshot): State {
  const present = snapshot.present;
  return {
    ...initialState(present),
    saved: snapshot.dirty ? { ...present } : present,
    activeDiagram: holdsDiagram(present, snapshot.activeDiagram)
      ? snapshot.activeDiagram
      : undefined,
    file: snapshot.file,
    recoveryCurrent: true,
  };
}

type ReadBound = Omit<
  Extract<ReadFailure, { readonly _tag: 'ExceededReadLimit' }>,
  '_tag'
>;

/**
 * What stopped a snapshot, as data the failure notice words. `Thrown` carries
 * the text a browser or the JSON parser raised, which no code describes.
 */
export type RecoveryProblem = Data.TaggedEnum<{
  Thrown: { readonly reason: string };
  PastBound: ReadBound;
  Unsupported: {};
  InvalidSnapshot: {};
  InvalidModel: {};
  EarlierRelease: { readonly writer: string | undefined };
}>;

/** Constructors for {@link RecoveryProblem}, plus Effect's `$match`. */
export const RecoveryProblem = Data.taggedEnum<RecoveryProblem>();

/** Why recovery storage could not supply or keep a snapshot. */
export type RecoveryStorageFailure = Data.TaggedEnum<{
  Rejected: { readonly problem: RecoveryProblem };
  Unavailable: { readonly problem: RecoveryProblem };
}>;

/** Constructors for {@link RecoveryStorageFailure}. */
export const RecoveryStorageFailure = Data.taggedEnum<RecoveryStorageFailure>();

/** Synchronous access to the one recovery snapshot. */
export type RecoveryStorage = {
  readonly load: () => Either.Either<
    RecoverySnapshot | undefined,
    RecoveryStorageFailure
  >;
  readonly replace: (
    snapshot: StoredSnapshot,
  ) => Either.Either<void, RecoveryStorageFailure>;
  readonly clear: () => Either.Either<void, RecoveryStorageFailure>;
};

type StorageBackend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Uses one Web Storage provider for recovery. */
export function localRecoveryStorage(
  storage: () => StorageBackend,
): RecoveryStorage {
  return {
    load: () =>
      Either.flatMap(readItem(storage), (stored) =>
        stored === null
          ? Either.right(undefined)
          : parseRecoverySnapshot(stored),
      ),
    replace: (snapshot) =>
      Either.flatMap(encodeSnapshot(snapshot), (encoded) =>
        accessStorage(storage, (available) => {
          available.setItem(recoveryStorageKey, encoded);
        }),
      ),
    clear: () =>
      accessStorage(storage, (available) => {
        available.removeItem(recoveryStorageKey);
      }),
  };
}

/** Recovery storage backed by the current browser profile. */
export const browserRecoveryStorage = localRecoveryStorage(
  () => globalThis.localStorage,
);

function readItem(
  storage: () => StorageBackend,
): Either.Either<string | null, RecoveryStorageFailure> {
  return accessStorage(storage, (available) =>
    available.getItem(recoveryStorageKey),
  );
}

function accessStorage<Value>(
  storage: () => StorageBackend,
  use: (available: StorageBackend) => Value,
): Either.Either<Value, RecoveryStorageFailure> {
  return Either.try({
    try: () => use(storage()),
    catch: (cause) =>
      unavailable(RecoveryProblem.Thrown({ reason: reasonOf(cause) })),
  });
}

function unavailable(problem: RecoveryProblem): RecoveryStorageFailure {
  return RecoveryStorageFailure.Unavailable({ problem });
}

function encodeSnapshot(
  snapshot: StoredSnapshot,
): Either.Either<string, RecoveryStorageFailure> {
  return Either.flatMap(
    Either.try({
      try: () => JSON.stringify(snapshot),
      catch: (cause) =>
        unavailable(RecoveryProblem.Thrown({ reason: reasonOf(cause) })),
    }),
    (encoded) =>
      Either.mapLeft(withinTextLimit(encoded), (failure) =>
        unavailable(readProblem(failure)),
      ),
  );
}

function parseRecoverySnapshot(
  stored: string,
): Either.Either<RecoverySnapshot, RecoveryStorageFailure> {
  const decoded = Either.mapLeft(
    parseWithinLimits(stored, (bounded) =>
      Either.try({
        try: () => JSON.parse(bounded) as unknown,
        catch: (cause) =>
          ReadFailure.MalformedText({ message: reasonOf(cause) }),
      }),
    ),
    (failure) =>
      RecoveryStorageFailure.Rejected({ problem: readProblem(failure) }),
  );
  return Either.flatMap(decoded, (value) =>
    Either.mapLeft(boundedParse(recoverySnapshotSchema, value), (failure) =>
      RecoveryStorageFailure.Rejected({
        problem: SchemaFailure.$match(failure, {
          Refused: () => refusal(value),
          IssueFlood: () => RecoveryProblem.InvalidSnapshot(),
          Threw: ({ reason }) => RecoveryProblem.Thrown({ reason }),
        }),
      }),
    ),
  );
}

const envelopeSchema = z.object({
  version: z.number(),
  writtenBy: z.object({ studioVersion: z.string() }).optional(),
});

function refusal(value: unknown): RecoveryProblem {
  const envelope = envelopeSchema.safeParse(value);
  return !envelope.success || envelope.data.version >= recoveryVersion
    ? RecoveryProblem.Unsupported()
    : RecoveryProblem.EarlierRelease({
        writer: envelope.data.writtenBy?.studioVersion,
      });
}

function readProblem(failure: ReadFailure): RecoveryProblem {
  return ReadFailure.$match(failure, {
    ExceededReadLimit: ({ limit, bound, observed }) =>
      RecoveryProblem.PastBound({ limit, bound, observed }),
    MalformedText: ({ message }) => RecoveryProblem.Thrown({ reason: message }),
    InvalidWireDocument: () => RecoveryProblem.InvalidSnapshot(),
    InvalidModel: () => RecoveryProblem.InvalidModel(),
  });
}
