import {
  escapedForTerminal,
  exceededReadLimit,
  quotedForTerminal,
  readAnyFormat,
  renderReadFailure,
  withinTextBytes,
  type DetectedRead,
  type DetectionFailure,
  type ReadFailure,
} from '@saerskriven/formats';
import { Data, Either } from 'effect';
import { readFileSync, realpathSync, statSync, type Stats } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { revisionOf } from './revision.js';

/**
 * What the host adds to the root for one call. `Pinned` is a server that
 * never asks, and `Unasked` one that follows the host on a call that stayed
 * under the root. The rest are a call that left it: the host declares no
 * roots, its answer carried no list, its list held more entries than the
 * server reads, so none of them was read, or it listed these real paths.
 */
export type HostDirectories = Data.TaggedEnum<{
  Pinned: {};
  Unasked: {};
  Undeclared: {};
  Unanswered: {};
  Overlong: { readonly entries: number; readonly limit: number };
  Listed: { readonly directories: readonly string[] };
}>;

/**
 * Constructor for {@link HostDirectories}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const HostDirectories = Data.taggedEnum<HostDirectories>();

/**
 * Where the server may read, and which model it reads when a tool names no
 * file. Both paths are real paths, resolved through every symbolic link when
 * the workspace opens. `host` is the one part that differs between calls.
 */
export type ModelWorkspace = {
  readonly root: string;
  readonly defaultFile: string | undefined;
  readonly host: HostDirectories;
};

/**
 * Why the server has no model to work with. A `path` or `requested` is the
 * spelling the call used, so a result names what the next call may pass.
 * `resolved` is the absolute path a refused one landed on, and `host` what
 * the host had added to the root when it was refused.
 */
export type WorkspaceFailure = Data.TaggedEnum<{
  NoRoot: { readonly root: string; readonly reason: string };
  OutsideRoot: {
    readonly requested: string;
    readonly resolved: string;
    readonly root: string;
    readonly host: HostDirectories;
  };
  Unreadable: { readonly path: string; readonly reason: string };
  Unread: {
    readonly path: string;
    readonly failure: ReadFailure | DetectionFailure;
  };
}>;

/**
 * Constructor for {@link WorkspaceFailure}, plus Effect's `$is` and `$match`
 * helpers.
 */
export const WorkspaceFailure = Data.taggedEnum<WorkspaceFailure>();

/** A model path beside the workspace it is resolved and confined in. */
export type NamedModel = {
  readonly workspace: ModelWorkspace;
  readonly file: string;
};

/** One file's bytes as the server read them, and the text they decode to. */
export type ReadTextFile = {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly text: string;
};

/** One model file as the server read it, with the handle a write quotes back. */
export type ReadModelFile = {
  readonly path: string;
  readonly revision: string;
  readonly read: DetectedRead;
};

/**
 * Whether a call may leave the root: `host` for a directory the host lists,
 * and never for a root that was `pinned`.
 */
export type Reach = 'host' | 'pinned';

/**
 * What the `mcp` invocation asked the server to work over. A request naming
 * no `reach` is pinned to its root.
 */
export type WorkspaceRequest = {
  readonly root: string;
  readonly file?: string;
  readonly reach?: Reach;
};

/**
 * The workspace an invocation describes, or why it cannot be opened. A root
 * that does not resolve, and a default file outside the root, are refused
 * here rather than at the first tool call. The default file is held to the
 * root whether or not the server follows the host.
 */
export function openWorkspace(
  request: WorkspaceRequest,
): Either.Either<ModelWorkspace, WorkspaceFailure> {
  return Either.flatMap(rootOf(request.root), (root) =>
    defaulting(
      {
        root,
        defaultFile: undefined,
        host: hostAsOpened[request.reach ?? 'pinned'],
      },
      request.file,
    ),
  );
}

/**
 * A requested path as the absolute path it resolves to, inside the root or a
 * directory the host listed for this call, or the refusal naming where it
 * landed. Every path this server reads or writes passes through here. A
 * relative path is resolved against the root. Symbolic links are followed on
 * the deepest ancestor that exists, so a path whose last segments do not
 * exist yet resolves too, and a link pointing out of every permitted
 * directory is refused.
 */
export function confined(
  workspace: ModelWorkspace,
  requested: string,
): Either.Either<string, WorkspaceFailure> {
  const resolved = realPathOf(resolve(workspace.root, requested));
  return permittedDirectories(workspace).some((directory) =>
    holds(directory, resolved),
  )
    ? Either.right(resolved)
    : Either.left(
        WorkspaceFailure.OutsideRoot({
          requested,
          resolved,
          root: workspace.root,
          host: workspace.host,
        }),
      );
}

/**
 * The model a call reads, as the path to resolve and the workspace to hold it
 * to: the file the call names under what the call permits, or the default
 * file under the root alone. `--file` means the root on every call, so a
 * default file since replaced by a link into a listed directory is refused.
 * Nothing where the call names no file and the server carries no default.
 */
export function namedModel(
  workspace: ModelWorkspace,
  file: string | undefined,
): NamedModel | undefined {
  if (file !== undefined) {
    return { workspace, file };
  }
  return workspace.defaultFile === undefined
    ? undefined
    : { workspace: heldToRoot(workspace), file: workspace.defaultFile };
}

/**
 * The text of a file a tool call names, held to the directories
 * {@link confined} permits. The entry is measured before it is read: anything
 * but a regular file is refused, so a FIFO cannot block the synchronous read,
 * a file past the shared text bound costs a `stat` rather than its length in
 * memory, and a failed `stat` refuses.
 */
export function readTextFile(
  workspace: ModelWorkspace,
  requested: string,
): Either.Either<ReadTextFile, WorkspaceFailure> {
  return Either.flatMap(confined(workspace, requested), (path) =>
    Either.flatMap(readableFile(path, requested), () =>
      Either.map(bytesOf(path, requested), (bytes) => ({
        path,
        bytes,
        text: Buffer.from(bytes).toString('utf8'),
      })),
    ),
  );
}

/**
 * The model a tool call names, read through format detection on the bounds
 * {@link readTextFile} applies.
 */
export function readModelFile(
  workspace: ModelWorkspace,
  requested: string,
): Either.Either<ReadModelFile, WorkspaceFailure> {
  return Either.flatMap(readTextFile(workspace, requested), (file) =>
    Either.mapBoth(readAnyFormat(file.text), {
      onLeft: (failure) =>
        WorkspaceFailure.Unread({ path: requested, failure }),
      onRight: (read) => ({
        path: file.path,
        revision: revisionOf(file.bytes),
        read,
      }),
    }),
  );
}

/**
 * The path a result names a file by: relative to the root for a file under
 * it, and absolute for one in a directory the host listed. A later call
 * passing either spelling back reaches the same file.
 */
export function resultPath(workspace: ModelWorkspace, path: string): string {
  return holds(workspace.root, path) ? relative(workspace.root, path) : path;
}

/** Why the server has no model, as the lines a tool result carries. */
export function renderWorkspaceFailure(
  failure: WorkspaceFailure,
): readonly string[] {
  return WorkspaceFailure.$match(failure, {
    NoRoot: ({ root, reason }) => [
      `The root ${quotedForTerminal(root)} cannot be used: ${escapedForTerminal(reason)}.`,
    ],
    OutsideRoot: ({ requested, resolved, root, host }) => [
      HostDirectories.$is('Listed')(host)
        ? `The file ${quotedForTerminal(requested)} is outside every directory this server may read.`
        : `The file ${quotedForTerminal(requested)} is outside the root this server may read.`,
      `It resolves to ${quotedForTerminal(resolved)}, and the root is ${quotedForTerminal(root)}.`,
      ...hostLines(host),
    ],
    Unreadable: ({ path, reason }) => [
      `The file ${quotedForTerminal(path)} cannot be read: ${escapedForTerminal(reason)}.`,
    ],
    Unread: ({ path, failure: refusal }) => [
      `The file ${quotedForTerminal(path)} was not read.`,
      ...renderReadFailure(refusal),
    ],
  });
}

/**
 * The extension a path ends in, lowercase with its dot, or empty. A dotfile
 * such as `.png` has none.
 */
export function extensionOf(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot).toLowerCase();
}

/** What a thrown value says, for the system's own sentence on a failure. */
export function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function rootOf(root: string): Either.Either<string, WorkspaceFailure> {
  return Either.try({
    try: () => realpathSync(resolve(root)),
    catch: (error) =>
      WorkspaceFailure.NoRoot({ root, reason: reasonOf(error) }),
  });
}

function defaulting(
  empty: ModelWorkspace,
  file: string | undefined,
): Either.Either<ModelWorkspace, WorkspaceFailure> {
  return file === undefined
    ? Either.right(empty)
    : Either.map(confined(empty, file), (defaultFile): ModelWorkspace => ({
        ...empty,
        defaultFile,
      }));
}

const hostAsOpened: Readonly<Record<Reach, HostDirectories>> = {
  host: HostDirectories.Unasked(),
  pinned: HostDirectories.Pinned(),
};

function permittedDirectories(workspace: ModelWorkspace): readonly string[] {
  return HostDirectories.$is('Listed')(workspace.host)
    ? [workspace.root, ...workspace.host.directories]
    : [workspace.root];
}

function heldToRoot(workspace: ModelWorkspace): ModelWorkspace {
  return HostDirectories.$is('Listed')(workspace.host)
    ? { ...workspace, host: HostDirectories.Unasked() }
    : workspace;
}

function holds(directory: string, path: string): boolean {
  return path === directory || path.startsWith(directory + sep);
}

function hostLines(host: HostDirectories): readonly string[] {
  return HostDirectories.$match(host, {
    Pinned: () => [
      'The server was started with --root, so it reads that directory alone.',
    ],
    Unasked: () => [],
    Undeclared: () => [
      'The host lists no directories, so the server reads its root alone.',
    ],
    Unanswered: () => [
      'The host was asked for its directories and sent no list.',
    ],
    Overlong: ({ entries, limit }) => [
      `The host listed ${String(entries)} entries, past the ${String(limit)} the server reads, so it read none of them.`,
    ],
    Listed: ({ directories }) => [
      directories.length === 0
        ? 'The host lists no directory the server can use.'
        : `The host lists ${directories.map(quotedForTerminal).join(', ')}.`,
    ],
  });
}

function realPathOf(path: string): string {
  const below: string[] = [];
  let current = path;
  for (;;) {
    const resolved = Either.getOrUndefined(
      Either.try(() => realpathSync(current)),
    );
    if (resolved !== undefined) {
      return join(resolved, ...below);
    }
    const parent = dirname(current);
    if (parent === current) {
      return join(current, ...below);
    }
    below.unshift(basename(current));
    current = parent;
  }
}

function readableFile(
  path: string,
  requested: string,
): Either.Either<void, WorkspaceFailure> {
  return Either.flatMap(statted(path, requested), (stats) =>
    stats.isFile()
      ? withinSizeBound(stats.size, requested)
      : Either.left(
          WorkspaceFailure.Unreadable({
            path: requested,
            reason: 'it is not a regular file',
          }),
        ),
  );
}

function statted(
  path: string,
  requested: string,
): Either.Either<Stats, WorkspaceFailure> {
  return Either.try({
    try: () => statSync(path),
    catch: (error) =>
      WorkspaceFailure.Unreadable({
        path: requested,
        reason: reasonOf(error),
      }),
  });
}

function withinSizeBound(
  size: number,
  requested: string,
): Either.Either<void, WorkspaceFailure> {
  return withinTextBytes(size)
    ? Either.right(undefined)
    : Either.left(
        WorkspaceFailure.Unread({
          path: requested,
          failure: exceededReadLimit('maxTextBytes', size),
        }),
      );
}

function bytesOf(
  path: string,
  requested: string,
): Either.Either<Uint8Array, WorkspaceFailure> {
  return Either.try({
    try: () => readFileSync(path),
    catch: (error) =>
      WorkspaceFailure.Unreadable({
        path: requested,
        reason: reasonOf(error),
      }),
  });
}
