import { parse as parseToml } from 'smol-toml';
import type {
  HostPlatform,
  HostSyntax,
  InstallEnvironment,
} from './mcp-hosts.js';

/**
 * An environment whose project directory and home directory are both the one
 * given, so a spec's writes land under a temporary directory and never near
 * the machine's own configuration.
 */
export function installedIn(
  directory: string,
  platform: HostPlatform = 'other',
): InstallEnvironment {
  return { directory, home: directory, platform, appData: undefined };
}

/**
 * An environment that names no home directory and no application data
 * directory, so no user-level file can be placed.
 */
export function homelessIn(directory: string): InstallEnvironment {
  return { directory, home: undefined, platform: 'other', appData: undefined };
}

/** A host file's text read back in the syntax the host keeps it in. */
export const parsedAs = (syntax: HostSyntax, text: string): unknown =>
  syntax === 'json' ? JSON.parse(text) : parseToml(text);

/** The entry a host that infers the transport holds for the server. */
export const stdio = { command: 'saer', args: ['mcp'] };

/** The entry a host that asks for the transport holds for the server. */
export const declared = { type: 'stdio', command: 'saer', args: ['mcp'] };

/**
 * A host file already holding another server under the key given, beside a
 * top-level setting that has nothing to do with MCP. A registration written
 * into this file has to leave both where they are.
 */
export function occupiedJson(serversKey: string): string {
  return `${JSON.stringify(
    {
      theme: 'dark',
      [serversKey]: {
        'other-server': { command: 'other', args: ['serve'] },
      },
    },
    null,
    2,
  )}\n`;
}

/** The same file for a host that keeps its configuration in TOML. */
export const occupiedToml = `model = "gpt-5"

[mcp_servers.other-server]
command = "other"
args = ["serve"]
`;

/** A host file no JSON parser will read. */
export const malformedJson = '{ "mcpServers": { "other": }\n';

/** A host file no TOML parser will read. */
export const malformedToml = '[mcp_servers\ncommand = "other"\n';

/** A host file whose table of servers is a string. */
export const misshapenJson = '{ "mcpServers": "none of them" }\n';
