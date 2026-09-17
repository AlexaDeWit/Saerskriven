import { InMemoryTransport } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { Either } from 'effect';
import { connectedClient, type Era, type McpSession } from '../fixtures.js';
import type { RasterizerAssets } from './render-diagram.js';
import { createSaerskrivenServer } from './server.js';
import { openWorkspace, renderWorkspaceFailure } from './workspace.js';

type SessionRequest = {
  readonly root: string;
  readonly file?: string;
  readonly era: Era;
  readonly rasterizer?: RasterizerAssets;
};

/**
 * A rasterizer an install does not have, which is what a render answers a
 * host with where the module was never built.
 */
export const noRasterizer: RasterizerAssets = () =>
  Either.left('this fixture carries no rasterizer module');

/**
 * A session over a linked in-memory pair against a server confined to
 * `root`. The server is served through `serveStdio` so it answers
 * `server/discover`, which a bare `McpServer.connect` does not. The
 * rasterizer defaults to {@link noRasterizer}, since the module is built from
 * Rust and no dev shell exports it, so a session that does not mean to draw
 * gets the refusal rather than a skipped suite.
 */
export async function session(request: SessionRequest): Promise<McpSession> {
  const workspace = openWorkspace({ root: request.root, file: request.file });
  if (Either.isLeft(workspace)) {
    throw new Error(renderWorkspaceFailure(workspace.left).join('\n'));
  }
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const handle = serveStdio(
    () =>
      createSaerskrivenServer({
        workspace: workspace.right,
        version: '0.0.0-spec',
        rasterizer: request.rasterizer ?? noRasterizer,
      }),
    { transport: serverSide, legacy: 'serve' },
  );
  return connectedClient(clientSide, request.era, () => handle.close());
}
