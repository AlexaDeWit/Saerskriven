import { InMemoryTransport } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { Either } from 'effect';
import {
  connectedClient,
  type Era,
  type HostRoots,
  type McpSession,
} from '../fixtures.js';
import type { RasterizerAssets } from './render-diagram.js';
import { createSaerskrivenServer } from './server.js';
import type { BrotliModule } from './share-link.js';
import {
  openWorkspace,
  renderWorkspaceFailure,
  type Reach,
} from './workspace.js';

type SessionRequest = {
  readonly root: string;
  readonly file?: string;
  readonly reach?: Reach;
  readonly roots?: HostRoots;
  readonly era: Era;
  readonly rasterizer?: RasterizerAssets;
  readonly brotli?: BrotliModule;
};

/**
 * A rasterizer an install does not have, which is what a render answers a
 * host with where the module was never built.
 */
export const noRasterizer: RasterizerAssets = () =>
  Either.left('this fixture carries no rasterizer module');

/**
 * A brotli module an install does not have, which is what a share link
 * answers a host with where the module was never built.
 */
export const noBrotli: BrotliModule = () =>
  Either.left('this fixture carries no brotli module');

/**
 * A session over a linked in-memory pair against a server confined to
 * `root`. The server is served through `serveStdio` so it answers
 * `server/discover`, which a bare `McpServer.connect` does not. The
 * rasterizer defaults to {@link noRasterizer} and the brotli module to
 * {@link noBrotli}, since both are built from Rust and no dev shell exports
 * either, so a session that means neither to draw nor to share gets the
 * refusal rather than a skipped suite. `reach` makes the server follow its
 * host, and `roots` gives the client a list to answer `roots/list` with.
 */
export async function session(request: SessionRequest): Promise<McpSession> {
  const workspace = openWorkspace({
    root: request.root,
    file: request.file,
    reach: request.reach,
  });
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
        brotli: request.brotli ?? noBrotli,
      }),
    { transport: serverSide, legacy: 'serve' },
  );
  return connectedClient(
    clientSide,
    request.era,
    () => handle.close(),
    request.roots,
  );
}
