import { repositoryRoot } from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { fakeAssets, scratchDirectory } from './cli.fixtures.js';
import { brotliIn, mcpOptionsSchema, rasterizerIn, serveMcp } from './mcp.js';

const served = (root: string) => {
  const input = new PassThrough();
  const output = new PassThrough();
  const outcome = serveMcp(mcpOptionsSchema.parse({ root }), { input, output });
  return { input, output, outcome };
};

describe('what the mcp subcommand is given', () => {
  it('reads the working directory as the root where none is named, and follows the host from it', () => {
    expect(mcpOptionsSchema.parse({})).toEqual({
      root: process.cwd(),
      reach: 'host',
      file: undefined,
    });
  });

  it('pins the server to a root it is given', () => {
    expect(mcpOptionsSchema.parse({ root: 'elsewhere' })).toEqual({
      root: 'elsewhere',
      reach: 'pinned',
      file: undefined,
    });
  });
});

const disposable = (): string => fakeAssets(scratchDirectory('mcp'));

const loaders: readonly [
  string,
  (assets: string) => () => Either.Either<unknown, string>,
][] = [
  ['rasterizer', rasterizerIn],
  ['brotli module', brotliIn],
];

describe.each(loaders)('the %s one server reads', (_what, readIn) => {
  it('answers every call from bytes read once, the directory gone', () => {
    const directory = disposable();
    const read = readIn(directory);
    const first = read();
    rmSync(directory, { recursive: true, force: true });
    expect(Either.isRight(first)).toBe(true);
    expect(read()).toEqual(first);
  });

  it('re-reads a directory it could not read rather than holding the refusal', () => {
    const directory = scratchDirectory('mcp-bare');
    const read = readIn(directory);
    expect(Either.isLeft(read())).toBe(true);
    fakeAssets(directory);
    expect(Either.isRight(read())).toBe(true);
  });
});

describe('the mcp subcommand as it runs', () => {
  it('refuses a root that is not there, saying so on standard error', async () => {
    const missing = join(repositoryRoot, 'nowhere-at-all');
    const outcome = await serveMcp(mcpOptionsSchema.parse({ root: missing }));
    expect(outcome.code).toEqual(2);
    expect(outcome.out).toEqual('');
    expect(outcome.err).toContain(`The root "${missing}" cannot be used`);
  });

  it('ends when the host closes the input, writing nothing anywhere', async () => {
    const session = served(repositoryRoot);
    session.input.end();
    expect(await session.outcome).toEqual({ code: 0, out: '', err: '' });
    expect(session.output.read()).toBeNull();
  });
});
