import { committedText } from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import { brotliUnbuilt, brotliWasm } from './fixtures.js';
import { corpusTexts } from './lib/corpus.fixtures.js';
import {
  frozenV021Path,
  nativeFixtures,
  readOrThrow,
} from './lib/saerskriven-yaml.fixtures.js';
import { saerskrivenYamlCodec } from './lib/saerskriven-yaml.js';
import { threatDragonReading } from './lib/threat-dragon.fixtures.js';
import { readFileSync } from 'node:fs';
import { hostedStudioUrl } from './hosted-studio.js';
import { readShareLink, shareLinkLimit, writeShareLink } from './share-link.js';
import { readShareLinkPoc, writeShareLinkPoc } from './share-link-poc.js';

const fixtures = [
  ...nativeFixtures.map(({ name, text }) => ({
    name,
    model: readOrThrow(text).model,
  })),
  ...corpusTexts.map(({ name, text }) => ({
    name,
    model: threatDragonReading(text).model,
  })),
];

const feature = readOrThrow(
  committedText('saerskriven/feature-complete.yaml'),
).model;
const fragment = (name: string) =>
  committedText('share-links/' + name + '.fragment.txt').trimEnd();

describe.skipIf(brotliUnbuilt)('experimental share links', () => {
  it.each(fixtures)(
    'selects the shortest lossless link for $name',
    async ({ name, model }) => {
      const result = Either.getOrThrow(
        await writeShareLinkPoc(model, hostedStudioUrl, brotliWasm()),
      );
      expect(result.link.length).toBe(
        Math.min(result.baselineLength, result.brotliLength, result.ppmdLength),
      );
      expect(result.link.length / result.baselineLength).toBeLessThanOrEqual(
        name === 'Saerskriven model' ? 0.852 : 0.85,
      );
      const restored = Either.getOrThrow(
        await readShareLinkPoc(new URL(result.link).hash, brotliWasm()),
      );
      expect(restored.divergences).toEqual([]);
      expect(saerskrivenYamlCodec.write(restored.model).output).toBe(
        saerskrivenYamlCodec.write(model).output,
      );
    },
  );

  it.each(['v2-brotli', 'v2-ppmd', 'v1-feature-complete'])(
    'reads the frozen %s encoding',
    async (name) => {
      const result = Either.getOrThrow(
        await readShareLinkPoc(fragment(name), brotliWasm()),
      );
      expect(saerskrivenYamlCodec.write(result.model).output).toBe(
        saerskrivenYamlCodec.write(feature).output,
      );
    },
  );

  it('keeps the default writer byte-compatible with its pre-PPMd module', async () => {
    const result = Either.getOrThrow(
      await writeShareLink(feature, hostedStudioUrl, brotliWasm()),
    );
    expect(new URL(result).hash).toBe(fragment('v1-feature-complete'));
  });

  it('migrates a frozen version 1 native document through the legacy path', async () => {
    const restored = Either.getOrThrow(
      await readShareLinkPoc(fragment('v1-v021'), brotliWasm()),
    );
    const expected = readOrThrow(readFileSync(frozenV021Path, 'utf8'));
    expect(restored).toEqual(expected);
  });

  it('leaves the released reader on encoding 1', async () => {
    const result = await readShareLink(fragment('v2-brotli'), brotliWasm());
    expect(Either.isLeft(result) && result.left._tag).toBe('UnknownEncoding');
  });

  it('replaces the base fragment and counts the whole URL before selecting', async () => {
    const first = Either.getOrThrow(
      await writeShareLinkPoc(feature, hostedStudioUrl, brotliWasm()),
    );
    const base =
      hostedStudioUrl + 'x'.repeat(shareLinkLimit - first.link.length);
    const exact = Either.getOrThrow(
      await writeShareLinkPoc(feature, base + '#old', brotliWasm()),
    );
    expect(exact.link.length).toBe(shareLinkLimit);
    expect(exact.baselineLength).toBeGreaterThan(shareLinkLimit);
    const tooLong = await writeShareLinkPoc(feature, base + 'x', brotliWasm());
    expect(Either.isLeft(tooLong) && tooLong.left._tag).toBe('TooLong');
  });

  it.each(['v2-brotli', 'v2-ppmd'])(
    'refuses truncated %s data',
    async (name) => {
      expect(
        Either.isLeft(
          await readShareLinkPoc(fragment(name).slice(0, -10), brotliWasm()),
        ),
      ).toBe(true);
    },
  );
});

describe('compact envelope validation before loading WASM', () => {
  it.each([
    '#share=2.Ag',
    '#share=2.',
    '#share=2.ж',
    '#share=2.A',
    '#share=2.AA==',
    '#share=999.AA',
  ])('refuses %s', async (value) => {
    const result = await readShareLinkPoc(value, new Uint8Array());
    expect(Either.isLeft(result)).toBe(true);
    expect(Either.isLeft(result) && result.left._tag).not.toBe('Unusable');
  });
});
