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
import { processStopped, serveHttp, type HttpHost } from './mcp-http.js';
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
 * launches the server, and `reach` is `host`: a stdio server follows the
 * directories its host lists. `--root` pins the server to that directory, and
 * `--http` holds it to its root, so neither asks the host. `--http` requires
 * `--token-file`, `--port` defaults to one the system picks, and both are
 * refused without `--http`. `http` is what the HTTP server needs, and nothing
 * where the server speaks stdio.
 */
export const mcpOptionsSchema = z
  .object({
    root: z.string().optional(),
    file: z.string().optional(),
    http: z.boolean().default(false),
    port: z.coerce.number().int().min(0).max(65_535).optional(),
    tokenFile: z.string().optional(),
  })
  .refine((options) => options.http || options.port === undefined, {
    path: ['port'],
    message: 'is given without --http',
  })
  .refine((options) => options.http || options.tokenFile === undefined, {
    path: ['token-file'],
    message: 'is given without --http',
  })
  .refine((options) => !options.http || options.tokenFile !== undefined, {
    path: ['token-file'],
    message: 'is required with --http, the only place the token is written',
  })
  .transform(({ root, http, port, tokenFile, ...workspace }) => ({
    ...workspace,
    root: root ?? process.cwd(),
    reach: reachOf(root, http),
    http:
      http && tokenFile !== undefined
        ? { port: port ?? 0, tokenFile }
        : undefined,
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

/**
 * The process as a server sees it: the streams stdio carries the protocol
 * over, and what the HTTP server reports through and stops on.
 */
export type McpHost = HttpHost & {
  readonly input: Readable;
  readonly output: Writable;
};

/** The running process's standard streams and signals. */
export function processHost(): McpHost {
  return {
    input: process.stdin,
    output: process.stdout,
    report: (text) => {
      process.stderr.write(text);
    },
    stopped: processStopped,
  };
}

/**
 * `saer mcp`: the MCP server over stdio until the host closes the input, or
 * with `--http` over Streamable HTTP until the process is signalled. Over
 * stdio, standard output carries the protocol alone, so what the transport
 * reported goes to standard error once the connection is over.
 */
export function serveMcp(
  options: McpOptions,
  host: McpHost = processHost(),
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
      return options.http === undefined
        ? servedOverStdio(factory, host)
        : serveHttp(factory, options.http, host);
    },
  });
}

function reachOf(root: string | undefined, http: boolean): Reach {
  if (http) {
    return 'http';
  }
  return root === undefined ? 'host' : 'pinned';
}

async function servedOverStdio(
  factory: McpServerFactory,
  host: McpHost,
): Promise<CommandOutcome> {
  const reported: string[] = [];
  const handle = serveStdio(factory, {
    transport: new StdioServerTransport(host.input, host.output),
    legacy: 'serve',
    onerror: (error) => {
      reported.push(`error: ${error.message}`);
    },
  });
  await ended(host.input);
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
