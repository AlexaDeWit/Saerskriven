import type { McpServerFactory } from '@modelcontextprotocol/server';
import {
  StdioServerTransport,
  serveStdio,
} from '@modelcontextprotocol/server/stdio';
import {
  createSaerskrivenServer,
  openWorkspace,
  renderWorkspaceFailure,
  type BrotliModule,
  type RasterizerAssets,
  type Reach,
} from '@saerskriven/mcp';
import { Either } from 'effect';
import type { Readable, Writable } from 'node:stream';
import { z } from 'zod';
import { runtimeAssets } from './assets.js';
import { pngAssets } from './png.js';
import {
  lines,
  succeeded,
  usageError,
  type CommandOutcome,
} from './outcome.js';
import { brotliModule } from './share.js';
import { cliVersion } from './version.js';

/**
 * What `mcp` needs, and the one gate on the option bag the parser hands over.
 * Without `--root` the root is the working directory, which is where a host
 * launches the server, and `reach` is `host`: the server follows the
 * directories its host lists. `--root` pins the server to that directory, so
 * it never asks the host.
 */
export const mcpOptionsSchema = z
  .object({
    root: z.string().optional(),
    file: z.string().optional(),
  })
  .transform(({ root, file }) => ({
    file,
    root: root ?? process.cwd(),
    reach: reachOf(root),
  }));

/** The options an `mcp` invocation was given. */
export type McpOptions = z.infer<typeof mcpOptionsSchema>;

/**
 * Where one server gets its rasterizer, read through the process-wide asset
 * cache, which re-reads a refusal.
 */
export function rasterizerIn(assets: string): RasterizerAssets {
  return () => pngAssets(assets);
}

/**
 * Where one server gets its brotli module, read through the process-wide
 * module cache, which re-reads a refusal.
 */
export function brotliIn(assets: string): BrotliModule {
  return () => brotliModule(assets);
}

/** The two streams a server carries the protocol over. */
export type McpStreams = {
  readonly input: Readable;
  readonly output: Writable;
};

/**
 * `saer mcp`: the MCP server over stdio, the one transport, until the host
 * closes the input. Standard output carries the protocol alone, so what the
 * transport reported goes to standard error once the connection is over.
 */
export function serveMcp(
  options: McpOptions,
  streams: McpStreams = { input: process.stdin, output: process.stdout },
  assets: string = runtimeAssets,
): Promise<CommandOutcome> {
  return Either.match(openWorkspace(options), {
    onLeft: (failure) =>
      Promise.resolve(usageError(lines(...renderWorkspaceFailure(failure)))),
    onRight: (workspace) => {
      const rasterizer = rasterizerIn(assets);
      const brotli = brotliIn(assets);
      const factory: McpServerFactory = () =>
        createSaerskrivenServer({
          workspace,
          version: cliVersion,
          rasterizer,
          brotli,
        });
      return servedOverStdio(factory, streams);
    },
  });
}

function reachOf(root: string | undefined): Reach {
  return root === undefined ? 'host' : 'pinned';
}

async function servedOverStdio(
  factory: McpServerFactory,
  streams: McpStreams,
): Promise<CommandOutcome> {
  const reported: string[] = [];
  const handle = serveStdio(factory, {
    transport: new StdioServerTransport(streams.input, streams.output),
    legacy: 'serve',
    onerror: (error) => {
      reported.push(`error: ${error.message}`);
    },
  });
  await ended(streams.input);
  await handle.close();
  return succeeded('', lines(...reported));
}

function ended(input: Readable): Promise<void> {
  return new Promise((resolve) => {
    const settle = (): void => {
      resolve();
    };
    input.once('end', settle);
    input.once('close', settle);
  });
}
