import {
  CLIENT_CAPABILITIES_META_KEY,
  inputRequired,
  type InputRequiredResult,
  type McpServer,
  type ServerContext,
} from '@modelcontextprotocol/server';
import { Either } from 'effect';
import { realpathSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { HostDirectories, confined, type ModelWorkspace } from './workspace.js';

/**
 * What one request says for the host: whether it declares roots, and the
 * answers a retried request carries, which are absent on a first request.
 * Both come from the host process and neither from a tool argument.
 */
export type HostTurn = {
  readonly declaresRoots: boolean;
  readonly responses: Readonly<Record<string, unknown>> | undefined;
};

/** The key the one `roots/list` request of a round is sent and answered under. */
export const rootsRequestKey = 'roots';

/**
 * The most entries of a roots answer the server reads, well above the
 * directories a session grants. Each entry costs a path resolution, so a
 * longer list is read not at all rather than in part.
 */
export const maxListedRoots = 64;

/**
 * The bounds on the round a 2025-era host is asked in, which the SDK holds
 * open as a request of its own: one re-entry, since no call asks twice, and
 * half a minute for the answer, where the SDK's own bound is ten minutes. A
 * 2026-07-28 host retries the call itself, so nothing is held open for it.
 */
export const hostRoundLimits = { maxRounds: 1, roundTimeoutMs: 30_000 };

/**
 * The host's side of one request. A 2026-07-28 request states its
 * capabilities in its own envelope, where the server's accessor holds none,
 * and a 2025-era connection states them once, at `initialize`.
 */
export function hostTurnOf(server: McpServer, ctx: ServerContext): HostTurn {
  const envelope = envelopeSchema.safeParse(ctx.mcpReq.envelope);
  const declared = envelope.success
    ? envelope.data[CLIENT_CAPABILITIES_META_KEY]
    : undefined;
  return {
    declaresRoots: declaringRootsSchema.safeParse(
      declared ?? server.server.getClientCapabilities(),
    ).success,
    responses: ctx.mcpReq.inputResponses,
  };
}

/**
 * The workspace one call runs against, or the round that asks the host for
 * its directories. The host is asked only by a server that follows it, only
 * where a path of the call leaves the root, and only once: a request that
 * already carries answers is never answered with a second round. A server
 * that does not follow the host reads no answer, so one attached to a call it
 * never asked about changes nothing.
 */
export function workspaceForCall(
  workspace: ModelWorkspace,
  paths: readonly (string | undefined)[],
  turn: HostTurn,
): Either.Either<ModelWorkspace, InputRequiredResult> {
  if (
    !HostDirectories.$is('Unasked')(workspace.host) ||
    paths.every((path) => path === undefined || underRoot(workspace, path))
  ) {
    return Either.right(workspace);
  }
  if (!turn.declaresRoots) {
    return Either.right({ ...workspace, host: HostDirectories.Undeclared() });
  }
  return turn.responses === undefined
    ? Either.left(
        inputRequired({
          inputRequests: { [rootsRequestKey]: inputRequired.listRoots() },
        }),
      )
    : Either.right({
        ...workspace,
        host: listedDirectories(turn.responses[rootsRequestKey]),
      });
}

/**
 * The directories a `roots/list` answer names. An entry counts when it is a
 * {@link localFileUrl} resolving, through every symbolic link, to a directory
 * that exists and is not the file-system root, and any other entry is passed
 * over. An answer that is no list of entries is `Unanswered`, and one past
 * {@link maxListedRoots} entries is `Overlong` with no entry read.
 */
export function listedDirectories(answer: unknown): HostDirectories {
  const listed = rootsAnswerSchema.safeParse(answer);
  if (!listed.success) {
    return HostDirectories.Unanswered();
  }
  const entries = listed.data.roots;
  return entries.length > maxListedRoots
    ? HostDirectories.Overlong({
        entries: entries.length,
        limit: maxListedRoots,
      })
    : HostDirectories.Listed({ directories: entries.flatMap(directoryOf) });
}

/**
 * A root's URI as a file URL on this machine, or nothing. The scheme has to
 * be `file` and the host empty, which is also how a URL parser reads
 * `localhost`. The host is decided here on every platform, since Windows
 * turns any other into the UNC path of a share on another machine.
 */
export function localFileUrl(uri: string): URL | undefined {
  const url = Either.getOrUndefined(Either.try(() => new URL(uri)));
  return url?.protocol === 'file:' && url.hostname === '' ? url : undefined;
}

const envelopeSchema = z.object({
  [CLIENT_CAPABILITIES_META_KEY]: z.unknown(),
});

const declaringRootsSchema = z.object({ roots: z.object({}) });

const rootsAnswerSchema = z.object({ roots: z.array(z.unknown()) });

const rootSchema = z.object({ uri: z.string() });

function underRoot(workspace: ModelWorkspace, path: string): boolean {
  return Either.isRight(confined(workspace, path));
}

function directoryOf(entry: unknown): readonly string[] {
  const root = rootSchema.safeParse(entry);
  const url = root.success ? localFileUrl(root.data.uri) : undefined;
  return url === undefined
    ? []
    : Either.getOrElse(
        Either.try(() => existingDirectory(url)),
        () => [],
      );
}

function existingDirectory(url: URL): readonly string[] {
  const path = realpathSync(fileURLToPath(url));
  return statSync(path).isDirectory() && dirname(path) !== path ? [path] : [];
}
