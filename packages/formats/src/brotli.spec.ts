import { committedText } from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';
import { brotliUnbuilt, brotliWasm } from './brotli.fixtures.js';
import { BrotliFailure, compressBrotli, decompressBrotli } from './brotli.js';

const mebibyte = 1_048_576;

const standardWindow = 16 * mebibyte;

const model = new TextEncoder().encode(
  committedText('saerskriven', 'feature-complete.yaml'),
);

const referenceStream = (bytes: Uint8Array, quality: number): Uint8Array =>
  brotliCompressSync(bytes, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: quality,
      [constants.BROTLI_PARAM_LGWIN]: 24,
    },
  });

const compressed = async (bytes: Uint8Array): Promise<Uint8Array> =>
  Either.getOrThrow(await compressBrotli(bytes, brotliWasm()));

const refusalOf = (
  outcome: Either.Either<unknown, BrotliFailure>,
): BrotliFailure | undefined =>
  Either.isLeft(outcome) ? outcome.left : undefined;

const wasmHeader = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

const section = (id: number, body: readonly number[]): number[] => [
  id,
  body.length,
  ...body,
];

const named = (name: string): number[] => {
  const bytes = [...new TextEncoder().encode(name)];
  return [bytes.length, ...bytes];
};

const calls = ['alloc', 'dealloc', 'compress', 'decompress', 'release'];

const moduleWhoseEveryCall = (body: readonly number[]): Uint8Array =>
  new Uint8Array([
    ...wasmHeader,
    ...section(1, [1, 0x60, 0, 1, 0x7f]),
    ...section(3, [1, 0]),
    ...section(5, [1, 0, 1]),
    ...section(7, [
      calls.length + 1,
      ...named('memory'),
      0x02,
      0,
      ...calls.flatMap((name) => [...named(name), 0x00, 0]),
    ]),
    ...section(10, [1, body.length + 2, 0, ...body, 0x0b]),
  ]);

const answeringZero = [0x41, 0];

const trapping = [0x00];

describe('a module that will not do the work', () => {
  it('reports bytes that are not a module', async () => {
    expect(
      refusalOf(await compressBrotli(model, new Uint8Array([1, 2, 3])))?._tag,
    ).toBe('Unusable');
  });

  it('reports a module that exports no codec', async () => {
    expect(
      refusalOf(await compressBrotli(model, new Uint8Array(wasmHeader))),
    ).toEqual(
      BrotliFailure.Unusable({
        sentence: 'the module exports no brotli codec',
      }),
    );
  });

  it('reports one that trapped, rather than throwing out of the call', async () => {
    expect(
      refusalOf(
        await decompressBrotli(model, moduleWhoseEveryCall(trapping), 10),
      )?._tag,
    ).toBe('Unusable');
  });

  it('reports one that reserved none of the memory asked for', async () => {
    expect(
      refusalOf(
        await compressBrotli(model, moduleWhoseEveryCall(answeringZero)),
      ),
    ).toEqual(
      BrotliFailure.Unusable({
        sentence: `the module reserved none of the ${model.length} bytes the input needs`,
      }),
    );
  });

  it.each([1.5, -1, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 32])(
    'refuses a maximum of %p rather than decoding to another bound',
    async (maximum) => {
      expect(
        refusalOf(
          await decompressBrotli(
            model,
            moduleWhoseEveryCall(trapping),
            maximum,
          ),
        ),
      ).toEqual(
        BrotliFailure.Unusable({
          sentence: `a maximum of ${maximum} is not a byte count from 0 to 4294967295`,
        }),
      );
    },
  );
});

describe.skipIf(brotliUnbuilt)('a model compressed through the module', () => {
  it('decodes back to the bytes it was given', async () => {
    const stream = await compressed(model);
    expect(stream.length).toBeLessThan(model.length);
    expect(
      Either.getOrThrow(
        await decompressBrotli(stream, brotliWasm(), model.length),
      ),
    ).toEqual(model);
  });

  it("writes standard brotli, which Node's zlib decodes", async () => {
    expect(
      new Uint8Array(brotliDecompressSync(await compressed(model))),
    ).toEqual(model);
  });

  it('declares a 24-bit window and compresses as tightly as quality 11', async () => {
    const stream = await compressed(model);
    const reference = referenceStream(model, 11);
    expect(stream[0] & 0x0f).toBe(reference[0] & 0x0f);
    expect(stream.length).toBeLessThanOrEqual(reference.length * 1.01);
  });

  it('decodes an empty stream to no bytes under a maximum of 0', async () => {
    const stream = await compressed(new Uint8Array(0));
    expect(
      Either.getOrThrow(await decompressBrotli(stream, brotliWasm(), 0)),
    ).toEqual(new Uint8Array(0));
  });
});

describe.skipIf(brotliUnbuilt)('a stream the decoder refuses', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses one byte past the maximum', async () => {
    const stream = await compressed(model);
    expect(
      refusalOf(await decompressBrotli(stream, brotliWasm(), model.length - 1)),
    ).toEqual(BrotliFailure.PastMaximum({ maximum: model.length - 1 }));
  });

  it('refuses 64 MiB of zeros against 1 MiB, holding the window and the maximum at most', async () => {
    const bomb = referenceStream(new Uint8Array(64 * mebibyte), 4);
    const instances: WebAssembly.Instance[] = [];
    const instantiate = WebAssembly.instantiate;
    vi.spyOn(WebAssembly, 'instantiate').mockImplementation(
      async (module: WebAssembly.Module) => {
        const instance = await instantiate(module);
        instances.push(instance);
        return instance;
      },
    );
    expect(
      refusalOf(await decompressBrotli(bomb, brotliWasm(), mebibyte)),
    ).toEqual(BrotliFailure.PastMaximum({ maximum: mebibyte }));
    const held = instances
      .map((instance) => instance.exports['memory'])
      .filter((memory) => memory instanceof WebAssembly.Memory)
      .map((memory) => memory.buffer.byteLength);
    expect(held).toHaveLength(1);
    expect(held[0]).toBeLessThan(standardWindow + mebibyte + 8 * mebibyte);
  });

  it.each([
    ['cut short', (stream: Uint8Array) => stream.subarray(0, -4)],
    ['followed by more bytes', (stream: Uint8Array) => [...stream, 0]],
    ['prose', () => new TextEncoder().encode('this is not brotli at all')],
    ['nothing', () => new Uint8Array(0)],
  ])('refuses %s as malformed', async (_what, take) => {
    const stream = new Uint8Array(take(await compressed(model)));
    expect(
      refusalOf(await decompressBrotli(stream, brotliWasm(), model.length)),
    ).toEqual(BrotliFailure.Malformed());
  });
});
