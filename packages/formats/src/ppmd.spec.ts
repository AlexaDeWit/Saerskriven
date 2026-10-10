import { Either } from 'effect';
import { brotliUnbuilt, brotliWasm } from './fixtures.js';
import { compressPpmd, decompressPpmd, PpmdFailure } from './ppmd.js';
import { readLimits } from './lib/read-limits.js';

const bytes = new TextEncoder().encode(
  'A threat model with repeated words. '.repeat(100),
);

describe.skipIf(brotliUnbuilt)('the fixed PPMd profile', () => {
  it.each([
    new Uint8Array(),
    bytes,
    new TextEncoder().encode('Écluse 日本語 🦦'),
  ])('reads the complete encoded bytes back', async (original) => {
    const encoded = Either.getOrThrow(
      await compressPpmd(original, brotliWasm()),
    );
    expect(
      Either.getOrThrow(
        await decompressPpmd(encoded, brotliWasm(), original.length),
      ),
    ).toEqual(original);
    expect(
      new DataView(
        encoded.buffer,
        encoded.byteOffset,
        encoded.byteLength,
      ).getUint32(0, true),
    ).toBe(original.length);
  });

  it.each([1, 2, 3, 4])(
    'refuses a stream missing %i ending bytes',
    async (lost) => {
      const encoded = Either.getOrThrow(
        await compressPpmd(bytes, brotliWasm()),
      );
      expect(
        await decompressPpmd(
          encoded.subarray(0, -lost),
          brotliWasm(),
          bytes.length,
        ),
      ).toEqual(Either.left(PpmdFailure.Malformed()));
    },
  );

  it('refuses bytes after the stream', async () => {
    const encoded = Either.getOrThrow(await compressPpmd(bytes, brotliWasm()));
    const followed = new Uint8Array(encoded.length + 1);
    followed.set(encoded);
    expect(await decompressPpmd(followed, brotliWasm(), bytes.length)).toEqual(
      Either.left(PpmdFailure.Malformed()),
    );
  });

  it('checks the content checksum', async () => {
    const encoded = Either.getOrThrow(await compressPpmd(bytes, brotliWasm()));
    encoded[4] ^= 1;
    expect(await decompressPpmd(encoded, brotliWasm(), bytes.length)).toEqual(
      Either.left(PpmdFailure.Malformed()),
    );
  });

  it('rejects a false short decoded length', async () => {
    const encoded = Either.getOrThrow(await compressPpmd(bytes, brotliWasm()));
    new DataView(
      encoded.buffer,
      encoded.byteOffset,
      encoded.byteLength,
    ).setUint32(0, bytes.length - 1, true);
    expect(await decompressPpmd(encoded, brotliWasm(), bytes.length)).toEqual(
      Either.left(PpmdFailure.Malformed()),
    );
  });

  it('refuses the declared output before trying to decode it', async () => {
    const header = new Uint8Array(8);
    new DataView(header.buffer).setUint32(0, readLimits.maxTextBytes + 1, true);
    expect(
      await decompressPpmd(header, brotliWasm(), readLimits.maxTextBytes),
    ).toEqual(
      Either.left(
        PpmdFailure.PastMaximum({ maximum: readLimits.maxTextBytes }),
      ),
    );
  });

  it('enforces the caller bound', async () => {
    const encoded = Either.getOrThrow(await compressPpmd(bytes, brotliWasm()));
    expect(
      await decompressPpmd(encoded, brotliWasm(), bytes.length - 1),
    ).toEqual(
      Either.left(PpmdFailure.PastMaximum({ maximum: bytes.length - 1 })),
    );
  });

  it('reports the fixed frame limit when a caller offers a larger budget', async () => {
    const header = new Uint8Array(8);
    new DataView(header.buffer).setUint32(0, readLimits.maxTextBytes + 1, true);
    expect(
      await decompressPpmd(header, brotliWasm(), readLimits.maxTextBytes * 2),
    ).toEqual(
      Either.left(
        PpmdFailure.PastMaximum({ maximum: readLimits.maxTextBytes }),
      ),
    );
  });

  it.each([new Uint8Array(), new Uint8Array(7), new Uint8Array(12)])(
    'refuses an incomplete or invalid frame',
    async (frame) => {
      expect(await decompressPpmd(frame, brotliWasm(), 100)).toEqual(
        Either.left(PpmdFailure.Malformed()),
      );
    },
  );
});
