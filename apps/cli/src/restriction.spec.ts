import { repositoryRoot } from '@saerskriven/model/fixtures';
import { execFile, spawn, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { connect, createServer, type Server, type Socket } from 'node:net';
import { join } from 'node:path';
import { setTimeout as settled } from 'node:timers/promises';
import { promisify } from 'node:util';
import { z } from 'zod';
import { scratchDirectory } from './cli.fixtures.js';
import { hostTarget, probePackagingTimeout } from './runners.fixtures.js';

const denied = 'ERR_ACCESS_DENIED';

const refusals = {
  connect: denied,
  fetch: denied,
  lookup: denied,
  listen: denied,
  datagram: denied,
  unixSocket: denied,
  spawn: denied,
  worker: denied,
  addon: 'ERR_DLOPEN_DISABLED',
  wasi: denied,
  inspector: denied,
  ffi: denied,
  opensslStore: denied,
} as const;

const channelSchema = z.enum([
  'connect',
  'fetch',
  'lookup',
  'listen',
  'datagram',
  'unixSocket',
  'spawn',
  'worker',
  'addon',
  'wasi',
  'inspector',
  'ffi',
  'opensslStore',
]);

const reportSchema = z.object({
  execArgv: z.array(z.string()),
  permitted: z.object({ asset: z.string(), sum: z.number() }),
  attempts: z.record(
    channelSchema,
    z.object({ allowed: z.boolean(), code: z.string().nullable() }),
  ),
});

type Report = z.infer<typeof reportSchema>;

type Run = { readonly report: Report; readonly written: string };

type Invocation = {
  readonly leading?: readonly string[];
  readonly trailing?: readonly string[];
  readonly options?: string;
  readonly cwd?: string;
};

const directory = scratchDirectory('restriction');

const staged = join(directory, 'staged');

const probe = join(directory, 'probe');

const unixPath = join(directory, 'listener.sock');

const configured = join(directory, 'configured');

const everyGrant = join(directory, 'every-grant.json');

const named = `--experimental-config-file=${everyGrant}`;

const embedded = 'an asset the probe carries\n';

const held = 'a file the probe may read\n';

const denial = '--no-allow-';

const asBuilt = 'as it is built';

const invocations: readonly (readonly [
  string,
  (grants: readonly string[]) => Invocation,
])[] = [
  [asBuilt, () => ({})],
  [
    'with every grant in NODE_OPTIONS',
    (grants) => ({ options: grants.join(' ') }),
  ],
  [
    'with every grant in a --node-options argument',
    (grants) => ({ trailing: [`--node-options=${grants.join(' ')}`] }),
  ],
  [
    'with a configuration file granting every scope as its last argument',
    () => ({ trailing: [named] }),
  ],
  ['with that file as its first argument', () => ({ leading: [named] })],
  ['with that file after a --', () => ({ trailing: ['--', named] })],
  [
    'with that file as the node.config.json of its working directory',
    () => ({
      trailing: ['--experimental-default-config-file'],
      cwd: configured,
    }),
  ],
];

const run = promisify(execFile);

const sorted = (flags: readonly string[]): string[] => {
  const copy = [...flags];
  copy.sort();
  return copy;
};

const listening = (
  server: Server,
  listen: (ready: () => void) => void,
): Promise<void> =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    listen(resolve);
  });

const answered = (open: () => Socket): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = open();
    socket.once('error', () => {
      resolve(false);
    });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
  });

const listenersOf = (pid: number): readonly string[] => {
  const descriptors = `/proc/${pid}/fd`;
  const sockets = new Set(
    readdirSync(descriptors).map((descriptor) =>
      readlinkSync(join(descriptors, descriptor)),
    ),
  );
  return ['/proc/net/tcp', '/proc/net/tcp6'].flatMap((table) =>
    readFileSync(table, 'utf8')
      .split('\n')
      .map((line) => line.trim().split(/\s+/u))
      .filter(
        (fields) => fields[3] === '0A' && sockets.has(`socket:[${fields[9]}]`),
      )
      .map((fields) => fields[1] ?? ''),
  );
};

const demanded = process.env.SAERSKRIVEN_COMPILED_RUNNER === 'required';

const title =
  'a probe packaged under the restriction every executable ships with';

(demanded ? describe : describe.skip)(
  demanded
    ? title
    : `${title}, skipped because only pnpm nx test-compiled @saerskriven/cli, which hashes what the probe is built from, runs it`,
  () => {
    const connections = { tcp: 0, unix: 0 };
    const tcp = createServer((socket) => {
      connections.tcp += 1;
      socket.destroy();
    });
    const unix = createServer((socket) => {
      connections.unix += 1;
      socket.destroy();
    });
    const tcpPort = (): number => {
      const address = tcp.address();
      return address !== null && typeof address === 'object' ? address.port : 0;
    };
    const runs = new Map<string, Run>();
    const grants: string[] = [];
    const packaging: { status: number | null; stderr: string } = {
      status: null,
      stderr: '',
    };

    const probed = async (
      index: number,
      invocation: Invocation,
    ): Promise<Run> => {
      const read = join(directory, `${index}.read`);
      const write = join(directory, `${index}.written`);
      writeFileSync(read, held);
      const { stdout } = await run(
        probe,
        [
          ...(invocation.leading ?? []),
          'probe',
          String(tcpPort()),
          unixPath,
          read,
          write,
          ...(invocation.trailing ?? []),
        ],
        {
          cwd: invocation.cwd ?? directory,
          env: { ...process.env, NODE_OPTIONS: invocation.options },
        },
      );
      return {
        report: reportSchema.parse(JSON.parse(stdout)),
        written: readFileSync(write, 'utf8'),
      };
    };

    beforeAll(async () => {
      mkdirSync(join(staged, 'assets'), { recursive: true });
      mkdirSync(configured);
      writeFileSync(
        join(staged, 'probe.mjs'),
        stripTypeScriptTypes(
          readFileSync(
            join(import.meta.dirname, 'restriction-probe.fixtures.ts'),
            'utf8',
          ),
        ),
      );
      writeFileSync(join(staged, 'assets/probe.txt'), embedded);
      const built = spawnSync(
        join(repositoryRoot, 'scripts/sea-executable.sh'),
        [staged, 'probe.mjs', hostTarget, probe],
        { encoding: 'utf8' },
      );
      packaging.status = built.status;
      packaging.stderr = built.stderr;
      if (built.status !== 0) {
        return;
      }
      await listening(tcp, (ready) => tcp.listen(0, '127.0.0.1', ready));
      await listening(unix, (ready) => unix.listen(unixPath, ready));
      const help = spawnSync(
        process.env.SAERSKRIVEN_SEA_NODE ?? '',
        ['--help'],
        {
          encoding: 'utf8',
        },
      );
      grants.push(
        ...sorted(
          [...new Set(help.stdout.match(/--allow-[a-z\d-]+/gu))].filter(
            (flag) => !/^--allow-fs-(?:read|write)$/u.test(flag),
          ),
        ),
      );
      const everyScope = JSON.stringify({
        permission: Object.fromEntries(
          grants.map((flag) => [flag.slice('--'.length), true]),
        ),
      });
      writeFileSync(everyGrant, everyScope);
      writeFileSync(join(configured, 'node.config.json'), everyScope);
      for (const [index, [name, invocation]] of invocations.entries()) {
        runs.set(name, await probed(index, invocation(grants)));
      }
    }, probePackagingTimeout);

    afterAll(() => {
      tcp.close();
      unix.close();
    });

    it('is packaged by the script every executable is packaged by', () => {
      expect(packaging).toMatchObject({ status: 0 });
    });

    it('grants file reads and writes, and denies by name every other permission flag its Node has', () => {
      const execArgv = runs.get(asBuilt)?.report.execArgv ?? [];
      expect({
        granted: execArgv.filter((argument) => !argument.startsWith(denial)),
        denied: sorted(
          execArgv
            .filter((argument) => argument.startsWith(denial))
            .map((argument) => `--allow-${argument.slice(denial.length)}`),
        ),
      }).toEqual({
        granted: ['--permission', '--allow-fs-read=*', '--allow-fs-write=*'],
        denied: grants,
      });
    });

    describe.each(invocations)('%s', (name) => {
      it('still reads and writes files, reads its assets and runs WebAssembly', () => {
        expect(runs.get(name)).toMatchObject({
          written: held,
          report: { permitted: { asset: embedded, sum: 5 } },
        });
      });

      it.each(channelSchema.options)('refuses %s', (channel) => {
        expect(runs.get(name)?.report.attempts[channel]).toEqual({
          allowed: false,
          code: refusals[channel],
        });
      });
    });

    it('reached neither listener, though both answer', async () => {
      expect(connections).toEqual({ tcp: 0, unix: 0 });
      await expect(
        answered(() => connect({ host: '127.0.0.1', port: tcpPort() })),
      ).resolves.toBe(true);
      await expect(answered(() => connect({ path: unixPath }))).resolves.toBe(
        true,
      );
    });

    it('opens no inspector when it is sent SIGUSR1', async () => {
      const waiting = spawn(probe, ['wait'], { cwd: directory });
      const streams = { out: '', err: '' };
      const said = (line: string): Promise<void> =>
        new Promise((resolve) => {
          const heard = (): void => {
            if (streams.out.includes(line)) {
              waiting.stdout.off('data', heard);
              resolve();
            }
          };
          waiting.stdout.on('data', heard);
          heard();
        });
      waiting.stdout.on('data', (chunk: Buffer) => {
        streams.out += chunk.toString();
      });
      waiting.stderr.on('data', (chunk: Buffer) => {
        streams.err += chunk.toString();
      });
      await said('waiting\n');
      waiting.kill('SIGUSR1');
      waiting.stdin.write('still here\n');
      await said('still here\n');
      await settled(250);
      const listeners = listenersOf(waiting.pid ?? 0);
      const closed = new Promise<{
        readonly code: number | null;
        readonly signal: string | null;
      }>((resolve) => {
        waiting.once('close', (code, signal) => {
          resolve({ code, signal });
        });
      });
      waiting.stdin.end();
      expect({ ...(await closed), listeners, said: streams.err }).toEqual({
        code: 0,
        signal: null,
        listeners: [],
        said: '',
      });
    });
  },
);
