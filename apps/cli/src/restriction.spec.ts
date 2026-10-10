import { repositoryRoot } from '@saerskriven/model/fixtures';
import { execFile, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { connect, createServer, type Server, type Socket } from 'node:net';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { scratchDirectory } from './cli.fixtures.js';
import {
  compiledRunner,
  hostTarget,
  spawnTimeout,
} from './runners.fixtures.js';

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
]);

const reportSchema = z.object({
  permitted: z.object({ asset: z.string(), sum: z.number() }),
  attempts: z.record(
    channelSchema,
    z.object({ allowed: z.boolean(), code: z.string().nullable() }),
  ),
});

type Report = z.infer<typeof reportSchema>;

type Run = { readonly report: Report; readonly written: string };

const grants = [
  '--allow-net',
  '--allow-child-process',
  '--allow-worker',
  '--allow-addons',
  '--allow-wasi',
  '--allow-inspector',
];

const invocations = [
  { name: 'as it is built', args: [], options: undefined },
  {
    name: 'with every grant in NODE_OPTIONS',
    args: [],
    options: grants.join(' '),
  },
  {
    name: 'with every grant as an argument',
    args: [...grants, `--node-options=${grants.join(' ')}`],
    options: undefined,
  },
] as const;

const directory = scratchDirectory('restriction');

const staged = join(directory, 'staged');

const probe = join(directory, 'probe');

const unixPath = join(directory, 'listener.sock');

const embedded = 'an asset the probe carries\n';

const held = 'a file the probe may read\n';

const run = promisify(execFile);

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

const packaged = compiledRunner.absence === undefined;

const title =
  'a probe packaged under the restriction every executable ships with';

(packaged ? describe : describe.skip)(
  packaged ? title : `${title}, skipped because ${compiledRunner.absence}`,
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
    const packaging: { status: number | null; stderr: string } = {
      status: null,
      stderr: '',
    };

    beforeAll(async () => {
      mkdirSync(join(staged, 'assets'), { recursive: true });
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
      for (const [index, invocation] of invocations.entries()) {
        const read = join(directory, `${index}.read`);
        const write = join(directory, `${index}.written`);
        writeFileSync(read, held);
        const { stdout } = await run(
          probe,
          [
            'probe',
            String(tcpPort()),
            unixPath,
            read,
            write,
            ...invocation.args,
          ],
          { env: { ...process.env, NODE_OPTIONS: invocation.options } },
        );
        runs.set(invocation.name, {
          report: reportSchema.parse(JSON.parse(stdout)),
          written: readFileSync(write, 'utf8'),
        });
      }
    }, spawnTimeout);

    afterAll(() => {
      tcp.close();
      unix.close();
    });

    it('is packaged by the script every executable is packaged by', () => {
      expect(packaging).toMatchObject({ status: 0 });
    });

    describe.each(invocations)('$name', ({ name }) => {
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
  },
);
