import {
  CLIENT_CAPABILITIES_META_KEY,
  inputRequired,
  type InputRequiredResult,
  type McpServer,
  type ServerContext,
} from '@modelcontextprotocol/server';
import { Either } from 'effect';
import { realpathSync, statSync } from 'node:fs';
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
 * `file://` URI resolving, through every symbolic link, to a directory that
 * exists, and any other entry is passed over. An answer that is no list of
 * entries is `Unanswered`.
 */
export function listedDirectories(answer: unknown): HostDirectories {
  const listed = rootsAnswerSchema.safeParse(answer);
  return listed.success
    ? HostDirectories.Listed({
        directories: listed.data.roots.flatMap(directoryOf),
      })
    : HostDirectories.Unanswered();
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
  return root.success
    ? Either.getOrElse(
        Either.try(() => existingDirectory(new URL(root.data.uri))),
        () => [],
      )
    : [];
}

function existingDirectory(uri: URL): readonly string[] {
  const path = realpathSync(fileURLToPath(uri));
  return statSync(path).isDirectory() ? [path] : [];
}
