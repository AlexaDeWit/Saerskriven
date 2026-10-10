import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import {
  connectedClient,
  type Era,
  type HostRoots,
  type McpSession,
} from '@saerskriven/mcp/fixtures';
import { repositoryRoot } from '@saerskriven/model/fixtures';
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
 * A session with the runner's CLI, spawned with `args` and reached over its
 * standard streams. A session given no host is launched in the checkout by a
 * client that declares no roots. `era` decides the opening: `legacy` is the
 * 2025 `initialize` handshake and `modern` probes with `server/discover`
 * first.
 */
export function openSession(
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
