import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { Either } from 'effect';
import type { Era } from '../fixtures.js';
import type { RasterizerAssets } from './render-diagram.js';
import { createSaerskrivenServer } from './server.js';
import { openWorkspace, renderWorkspaceFailure } from './workspace.js';

/** A client joined to a server over the SDK's in-memory pair, and how to end it. */
export type Session = {
  readonly client: Client;
  readonly end: () => Promise<void>;
};

/**
 * What a session is over: its root, its default model, the era it opens in,
 * and where a render finds its rasterizer. The rasterizer defaults to
 * {@link noRasterizer}, since the module is built from Rust and no dev shell
 * exports it, so a session that does not mean to draw gets the refusal rather
 * than a skipped suite.
 */
export type SessionRequest = {
  readonly root: string;
  readonly file?: string;
  readonly era?: Era;
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
 * `server/discover`, which a bare `McpServer.connect` does not.
 */
export async function session(request: SessionRequest): Promise<Session> {
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
  const client = new Client(
    { name: 'saerskriven-spec', version: '0.0.0-spec' },
    {
      versionNegotiation: {
        mode: request.era === 'modern' ? 'auto' : 'legacy',
      },
    },
  );
  await client.connect(clientSide);
  return {
    client,
    end: async () => {
      await client.close();
      await handle.close();
    },
  };
}
