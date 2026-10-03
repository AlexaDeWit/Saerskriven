import { committedText } from '@saerskriven/model/fixtures';
import { moduleWhoseEveryCall, trapping } from '@saerskriven/wasm/fixtures';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';
import { brotliUnbuilt, brotliWasm } from './brotli.fixtures.js';
import { BrotliFailure, compressBrotli, decompressBrotli } from './brotli.js';
import { readLimits } from './lib/read-limits.js';
import { saerskrivenModelPath } from './lib/saerskriven-yaml.fixtures.js';

const mebibyte = 1_048_576;

const standardWindow = 16 * mebibyte;

const windowGap = 16;

const model = new TextEncoder().encode(
  committedText('saerskriven', 'feature-complete.yaml'),
);

const threatModel = new Uint8Array(readFileSync(saerskrivenModelPath));

const referenceStream = (bytes: Uint8Array, quality: number): Uint8Array =>
  brotliCompressSync(bytes, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: quality,
      [constants.BROTLI_PARAM_LGWIN]: 24,
    },
  });

const incompressible = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  let state = 0x9e3779b9;
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    bytes[index] = state & 0xff;
  }
  return bytes;
};

const zerosBomb = (): Uint8Array =>
  referenceStream(new Uint8Array(64 * mebibyte), 4);

const largeWindowBomb = (): Uint8Array =>
  brotliCompressSync(new Uint8Array(65 * mebibyte), {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 4,
      [constants.BROTLI_PARAM_LARGE_WINDOW]: 1,
      [constants.BROTLI_PARAM_LGWIN]: 30,
    },
  });

const bitsFrom = (stream: Uint8Array, start: number, count: number): number =>
  Array.from(
    { length: count },
    (_bit, offset) =>
      (stream[(start + offset) >> 3] >> ((start + offset) & 7)) & 1,
  ).reduce((value, bit, offset) => value | (bit << offset), 0);

const declaredWindowBits = (stream: Uint8Array): number => {
  if (bitsFrom(stream, 0, 1) === 0) {
    return 16;
  }
  const wide = bitsFrom(stream, 1, 3);
  if (wide !== 0) {
    return 17 + wide;
  }
  const narrow = bitsFrom(stream, 4, 3);
  return narrow === 0 ? 17 : 8 + narrow;
};

const withMemory = async <Value>(
  work: () => Promise<Value>,
): Promise<readonly [Value, readonly number[]]> => {
  const instances: WebAssembly.Instance[] = [];
  const instantiate = WebAssembly.instantiate;
  const spy = vi
    .spyOn(WebAssembly, 'instantiate')
    .mockImplementation(async (module: WebAssembly.Module) => {
      const instance = await instantiate(module);
      instances.push(instance);
      return instance;
    });
  try {
    const value = await work();
    return [
      value,
      instances
        .map((instance) => instance.exports['memory'])
        .filter((memory) => memory instanceof WebAssembly.Memory)
        .map((memory) => memory.buffer.byteLength),
    ];
  } finally {
    spy.mockRestore();
  }
};

const compressed = async (bytes: Uint8Array): Promise<Uint8Array> =>
  Either.getOrThrow(await compressBrotli(bytes, brotliWasm()));

const refusalOf = (
  outcome: Either.Either<unknown, BrotliFailure>,
): BrotliFailure | undefined =>
  Either.isLeft(outcome) ? outcome.left : undefined;

const codecCalls = [
  'input',
  'compress',
  'decompress',
  'output',
  'output_length',
];

const trappingCodec = (): Uint8Array =>
  moduleWhoseEveryCall(codecCalls, trapping);

describe('a module that will not do the work', () => {
  it('reports a module that exports no codec', async () => {
    expect(
      refusalOf(
        await compressBrotli(
          model,
          moduleWhoseEveryCall(['input', 'output', 'output_length'], trapping),
        ),
      ),
    ).toEqual(
      BrotliFailure.Unusable({
        sentence: 'the module exports no brotli codec',
      }),
    );
  });

  it('reports one that trapped, as an allocation it cannot make ends, rather than throwing out of the call', async () => {
    expect(
      refusalOf(await decompressBrotli(model, trappingCodec(), 10))?._tag,
    ).toBe('Unusable');
  });

  it.each([1.5, -1, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 32])(
    'refuses a maximum of %p rather than decoding to another bound',
    async (maximum) => {
      expect(
        refusalOf(await decompressBrotli(model, trappingCodec(), maximum)),
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

  it('declares the smallest window that covers the input, and compresses as tightly as quality 11', async () => {
    const stream = await compressed(model);
    const bits = declaredWindowBits(stream);
    expect(2 ** bits - windowGap).toBeGreaterThanOrEqual(model.length);
    expect(2 ** (bits - 1) - windowGap).toBeLessThan(model.length);
    expect(stream.length).toBeLessThanOrEqual(
      referenceStream(model, 11).length * 1.01,
    );
  });

  it('compresses a 59 KB model in under 12 MiB of module memory', async () => {
    const [stream, held] = await withMemory(() => compressed(threatModel));
    expect(new Uint8Array(brotliDecompressSync(stream))).toEqual(threatModel);
    expect(held).toHaveLength(1);
    expect(held[0]).toBeLessThan(12 * mebibyte);
  });

  it('compiles the module once for every call handed the same bytes', async () => {
    const wasm = new Uint8Array(brotliWasm());
    const compile = vi.spyOn(WebAssembly, 'compile');
    try {
      const stream = Either.getOrThrow(await compressBrotli(model, wasm));
      await decompressBrotli(stream, wasm, model.length);
      expect(compile).toHaveBeenCalledTimes(1);
    } finally {
      compile.mockRestore();
    }
  });

  it('decodes an empty stream to no bytes under a maximum of 0', async () => {
    const stream = await compressed(new Uint8Array(0));
    expect(
      Either.getOrThrow(await decompressBrotli(stream, brotliWasm(), 0)),
    ).toEqual(new Uint8Array(0));
  });
});

describe.skipIf(brotliUnbuilt)('a stream the decoder refuses', () => {
  it('refuses one byte past the maximum', async () => {
    const stream = await compressed(model);
    expect(
      refusalOf(await decompressBrotli(stream, brotliWasm(), model.length - 1)),
    ).toEqual(BrotliFailure.PastMaximum({ maximum: model.length - 1 }));
  });

  it.each([mebibyte, 5 * mebibyte, readLimits.maxTextBytes])(
    'refuses 64 MiB of zeros against a maximum of %i bytes, within the window, twice the maximum and 4 MiB',
    async (maximum) => {
      const [refusal, held] = await withMemory(async () =>
        refusalOf(await decompressBrotli(zerosBomb(), brotliWasm(), maximum)),
      );
      expect(refusal).toEqual(BrotliFailure.PastMaximum({ maximum }));
      expect(held).toHaveLength(1);
      expect(held[0]).toBeLessThan(standardWindow + 2 * maximum + 4 * mebibyte);
    },
  );

  it('refuses a 9 MiB incompressible stream against 8 MiB, within the window, the stream, twice the maximum and 4 MiB', async () => {
    const stream = referenceStream(incompressible(9 * mebibyte), 4);
    const maximum = readLimits.maxTextBytes;
    const [refusal, held] = await withMemory(async () =>
      refusalOf(await decompressBrotli(stream, brotliWasm(), maximum)),
    );
    expect(refusal).toEqual(BrotliFailure.PastMaximum({ maximum }));
    expect(held).toHaveLength(1);
    expect(held[0]).toBeLessThan(
      standardWindow + stream.length + 2 * maximum + 4 * mebibyte,
    );
  });

  it('refuses a stream that claims the large-window extension before reserving its window', async () => {
    const [refusal, held] = await withMemory(async () =>
      refusalOf(
        await decompressBrotli(largeWindowBomb(), brotliWasm(), mebibyte),
      ),
    );
    expect(refusal).toEqual(BrotliFailure.Malformed());
    expect(held).toHaveLength(1);
    expect(held[0]).toBeLessThan(4 * mebibyte);
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
