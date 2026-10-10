import { spawnSync } from 'node:child_process';
import { createSocket } from 'node:dgram';
import { lookup } from 'node:dns/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import { connect, createServer, type NetConnectOpts } from 'node:net';
import { dirname, join } from 'node:path';
import { getAsset } from 'node:sea';
import { Worker } from 'node:worker_threads';

declare const WebAssembly: {
  readonly Module: new (bytes: Uint8Array) => object;
  readonly Instance: new (module: object) => {
    readonly exports: Readonly<Record<string, unknown>>;
  };
};

type Outcome = { readonly allowed: boolean; readonly code: string | null };

type Attempt = () => Promise<unknown>;

const [, , role, tcpPort, unixPath, readPath, writePath] = process.argv;

if (
  role !== 'probe' ||
  tcpPort === undefined ||
  unixPath === undefined ||
  readPath === undefined ||
  writePath === undefined
) {
  process.exit(0);
}

const loopback = '127.0.0.1';

const codeOf = (error: unknown): string | null => {
  if (!(error instanceof Error)) {
    return null;
  }
  return 'code' in error && typeof error.code === 'string'
    ? error.code
    : codeOf(error.cause);
};

const attempted = (start: Attempt): Promise<Outcome> =>
  new Promise((resolve) => {
    const fail = (error: unknown): void => {
      process.removeListener('uncaughtException', fail);
      resolve({ allowed: false, code: codeOf(error) });
    };
    const pass = (): void => {
      process.removeListener('uncaughtException', fail);
      resolve({ allowed: true, code: null });
    };
    process.once('uncaughtException', fail);
    try {
      start().then(pass, fail);
    } catch (error) {
      fail(error);
    }
  });

const dial =
  (address: NetConnectOpts): Attempt =>
  () =>
    new Promise((resolve, reject) => {
      const socket = connect(address);
      socket.once('error', reject);
      socket.once('connect', () => {
        socket.destroy();
        resolve(address);
      });
    });

const channels: Readonly<Record<string, Attempt>> = {
  connect: dial({ host: loopback, port: Number(tcpPort) }),
  fetch: () => fetch(`http://${loopback}:${tcpPort}/`),
  lookup: () => lookup('localhost'),
  listen: () =>
    new Promise((resolve, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen(0, loopback, () => {
        resolve(server.close());
      });
    }),
  datagram: () =>
    new Promise((resolve, reject) => {
      const socket = createSocket('udp4');
      socket.once('error', reject);
      socket.bind(0, loopback, () => {
        resolve(socket.close());
      });
    }),
  unixSocket: dial({ path: unixPath }),
  spawn: () => {
    const child = spawnSync(process.execPath, ['idle']);
    return child.error === undefined
      ? Promise.resolve(child.status)
      : Promise.reject(child.error);
  },
  worker: () =>
    new Promise((resolve, reject) => {
      const worker = new Worker('', { eval: true });
      worker.once('error', reject);
      worker.once('exit', resolve);
    }),
  addon: () => {
    const addon = { exports: {} };
    process.dlopen(addon, join(dirname(writePath), 'absent.node'));
    return Promise.resolve(addon);
  },
  wasi: async () => {
    const { WASI } = await import('node:wasi');
    return new WASI({ version: 'preview1' });
  },
  inspector: async () => {
    const inspector = await import('node:inspector');
    inspector.open(0, loopback, false);
    inspector.close();
  },
};

const sumModule = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 7, 1, 96, 2, 127, 127, 1, 127, 3, 2, 1, 0, 7,
  7, 1, 3, 115, 117, 109, 0, 0, 10, 9, 1, 7, 0, 32, 0, 32, 1, 106, 11,
]);

const { sum } = new WebAssembly.Instance(new WebAssembly.Module(sumModule))
  .exports;

writeFileSync(writePath, readFileSync(readPath));

const permitted = {
  asset: new TextDecoder().decode(getAsset('assets/probe.txt')),
  sum:
    typeof sum === 'function'
      ? Number(Reflect.apply(sum, undefined, [2, 3]))
      : null,
};

const attempts: Record<string, Outcome> = {};
for (const [channel, start] of Object.entries(channels)) {
  attempts[channel] = await attempted(start);
}

process.stdout.write(`${JSON.stringify({ permitted, attempts })}\n`);
