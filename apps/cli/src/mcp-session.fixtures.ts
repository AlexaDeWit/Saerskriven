import { StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import {
  connectedClient,
  type Era,
  type HostRoots,
  type McpSession,
} from '@saerskriven/mcp/fixtures';
import { repositoryRoot } from '@saerskriven/model/fixtures';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Runner } from './runners.fixtures.js';

/**
 * The host a session's server runs under: the directory it is launched in,
 * and the roots its client lists, where it lists any.
 */
export type SessionHost = {
  readonly cwd: string;
  readonly roots?: HostRoots;
};

/**
 * A way of opening a session against a runner, named for a suite title. A
 * session given no host is launched in the checkout by a client that declares
 * no roots.
 */
export type SessionOpener = {
  readonly name: string;
  readonly open: (
    runner: Runner,
    args: readonly string[],
    era: Era,
    host?: SessionHost,
  ) => Promise<McpSession>;
};

async function stdioSession(
  runner: Runner,
  args: readonly string[],
  era: Era,
  host?: SessionHost,
): Promise<McpSession> {
  const transport = new StdioClientTransport({
    command: runner.command,
    args: [...runner.leading, ...args],
    cwd: host?.cwd ?? repositoryRoot,
    stderr: 'inherit',
  });
  return connectedClient(transport, era, () => Promise.resolve(), host?.roots);
}

type HttpProcess = {
  readonly url: URL;
  readonly tokenFile: string;
  readonly stop: () => Promise<{
    readonly code: number | null;
    readonly signal: NodeJS.Signals | null;
    readonly out: string;
    readonly err: string;
  }>;
};

/**
 * `saer mcp --http` spawned in `cwd` with a fresh token file, its address
 * read from standard error. Stopping it sends SIGTERM and resolves with the
 * exit code and everything the process wrote.
 */
export async function httpProcess(
  runner: Runner,
  args: readonly string[],
  cwd: string = repositoryRoot,
): Promise<HttpProcess> {
  const directory = mkdtempSync(join(tmpdir(), 'saerskriven-cli-http-'));
  const tokenFile = join(directory, 'token');
  const child = spawn(
    runner.command,
    [...runner.leading, ...args, '--http', '--token-file', tokenFile],
    { cwd, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const written = { out: '', err: '' };
  child.stdout?.on('data', (chunk: Buffer) => {
    written.out += chunk.toString('utf8');
  });
  const url = await announcedUrl(child, written);
  return {
    url: new URL(url),
    tokenFile,
    stop: async () => {
      const exited = once(child, 'exit');
      child.kill('SIGTERM');
      await exited;
      rmSync(directory, { recursive: true, force: true });
      return { code: child.exitCode, signal: child.signalCode, ...written };
    },
  };
}

async function httpSession(
  runner: Runner,
  args: readonly string[],
  era: Era,
  host?: SessionHost,
): Promise<McpSession> {
  const server = await httpProcess(runner, args, host?.cwd);
  const token = readFileSync(server.tokenFile, 'utf8');
  const transport = new StreamableHTTPClientTransport(server.url, {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  return connectedClient(
    transport,
    era,
    async () => {
      await server.stop();
    },
    host?.roots,
  );
}

/** Stdio, the one transport over which a server follows its host. */
export const stdioOpener: SessionOpener = { name: 'stdio', open: stdioSession };

const httpOpener: SessionOpener = {
  name: 'Streamable HTTP',
  open: httpSession,
};

/**
 * Both transports a release serves the protocol over: a spawned process's
 * stdio, and Streamable HTTP carrying the token the server wrote. `era`
 * decides the opening: `legacy` is the 2025 `initialize` handshake and
 * `modern` probes with `server/discover` first.
 */
export const sessionOpeners: readonly SessionOpener[] = [
  stdioOpener,
  httpOpener,
];

/**
 * The two servers that never ask their host, each as its opener and the
 * arguments that start it so: stdio pinned by `--root`, and `--http` naming
 * no root, which over stdio would follow the host.
 */
export const hostBlindServers: readonly {
  readonly name: string;
  readonly opener: SessionOpener;
  readonly args: (launch: string) => readonly string[];
}[] = [
  {
    name: 'stdio with --root',
    opener: stdioOpener,
    args: (launch) => ['mcp', '--root', launch],
  },
  { name: 'Streamable HTTP', opener: httpOpener, args: () => ['mcp'] },
];

function announcedUrl(
  child: ChildProcess,
  written: { err: string },
): Promise<string> {
  return new Promise((resolve, reject) => {
    child.stderr?.on('data', (chunk: Buffer) => {
      written.err += chunk.toString('utf8');
      const found = /^MCP server at (\S+)$/m.exec(written.err)?.[1];
      if (found !== undefined) {
        resolve(found);
      }
    });
    child.once('exit', (code) => {
      reject(
        new Error(
          `saer mcp --http exited ${code} before listening: ${written.err}`,
        ),
      );
    });
  });
}
