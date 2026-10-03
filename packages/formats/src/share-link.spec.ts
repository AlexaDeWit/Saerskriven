import type { Model } from '@saerskriven/model';
import {
  incompressibleModel,
  parsedFixture,
} from '@saerskriven/model/fixtures';
import { Either, Option } from 'effect';
import { readFileSync } from 'node:fs';
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';
import { brotliUnbuilt, brotliWasm } from './fixtures.js';
import type { ReadFailure } from './lib/codec.js';
import { adversarialText, vendoredTexts } from './lib/corpus.fixtures.js';
import { exceededReadLimit, readLimits } from './lib/read-limits.js';
import {
  featureCompleteYaml,
  frozenV021Model,
  frozenV021Path,
  nativeFixtures,
  readOrThrow,
  withThreatsInNumberOrder,
} from './lib/saerskriven-yaml.fixtures.js';
import { saerskrivenYamlCodec } from './lib/saerskriven-yaml.js';
import { threatDragonReading } from './lib/threat-dragon.fixtures.js';
import {
  hostedStudioUrl,
  isShareLinkFragment,
  readShareLink,
  renderShareLinkWriteFailure,
  ShareLinkFailure,
  shareLinkLimit,
  ShareLinkWriteFailure,
  writeShareLink,
} from './share-link.js';

const marker = '#share=1.';

const noModule = new Uint8Array(0);

const notAModule = new Uint8Array([1, 2, 3]);

const featureComplete = readOrThrow(featureCompleteYaml).model;

const fixtures: readonly { name: string; model: Model }[] = [
  ...nativeFixtures.map(({ name, text }) => ({
    name,
    model: readOrThrow(text).model,
  })),
  ...vendoredTexts(['threat-dragon/demo'], (name) =>
    name.endsWith('.json'),
  ).map(({ name, text }) => ({ name, model: threatDragonReading(text).model })),
];

const densityCeilings: Readonly<Record<string, number>> = {
  'feature-complete file': 0.27,
  'two-diagram file': 0.23,
  'Saerskriven model': 0.34,
  'threat-dragon/demo/cryptocurrency-wallet.json': 0.18,
  'threat-dragon/demo/generic-cms.json': 0.27,
  'threat-dragon/demo/iot-device.json': 0.2,
  'threat-dragon/demo/online-game.json': 0.17,
  'threat-dragon/demo/payment-online.json': 0.21,
  'threat-dragon/demo/renting-car.json': 0.175,
  'threat-dragon/demo/three-tier-web-app.json': 0.28,
  'threat-dragon/demo/v2-new-model.json': 0.69,
  'threat-dragon/demo/v2-threat-model.json': 0.22,
};

const linkOf = async (model: Model, base = hostedStudioUrl): Promise<string> =>
  Either.getOrThrow(await writeShareLink(model, base, brotliWasm()));

const fragmentOf = (link: string): string => new URL(link).hash;

const payloadOf = (link: string): string =>
  link.slice(link.indexOf(marker) + marker.length);

const savedText = (model: Model): string =>
  saerskrivenYamlCodec.write(model).output;

const malformedMessage = (
  outcome: Either.Either<unknown, ShareLinkFailure | ReadFailure>,
): string | undefined => {
  const refusal = Option.getOrUndefined(Either.getLeft(outcome));
  return ShareLinkFailure.$is('Malformed')(refusal)
    ? refusal.message
    : undefined;
};

const holding = (bytes: Uint8Array): string =>
  `${marker}${brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 4 },
  }).toString('base64url')}`;

const incompressible = (bytes: number): Model =>
  incompressibleModel(featureComplete, bytes);

describe('the hosted studio', () => {
  it('is the canonical address, over https', () => {
    expect(hostedStudioUrl).toBe('https://saerskriven.com/');
  });
});

describe('why a write produced no link', () => {
  it('gives the length and the limit of a link past it, and says to send the file', () => {
    expect(
      renderShareLinkWriteFailure(
        ShareLinkWriteFailure.TooLong({
          length: 1_200_000,
          limit: shareLinkLimit,
        }),
      ),
    ).toEqual([
      'The link would be 1200000 characters, past the 1048576 a share link may hold, so none was written.',
      'Send the file itself instead.',
    ]);
  });

  it('gives the size and the bound of a model past the read bound, and says to send the file', () => {
    expect(
      renderShareLinkWriteFailure(
        ShareLinkWriteFailure.PastReadBound({ size: 9_000_000 }),
      ),
    ).toEqual([
      'The model is 9000000 bytes as Saerskriven YAML, past the 8388608 bytes a read accepts, so no link to it would open.',
      'Send the file itself instead.',
    ]);
  });

  it("carries the module's own sentence, escaped, where it did not run", () => {
    expect(
      renderShareLinkWriteFailure(
        ShareLinkWriteFailure.Unusable({ sentence: 'it \u001b[31mtrapped' }),
      ),
    ).toEqual([
      'The brotli module a link is compressed with did not run: it \\u001b[31mtrapped.',
    ]);
  });
});

describe('a fragment', () => {
  it.each(['#share=1.G2QA', '#share=', '#share=2.abc'])(
    'carries a share link as %j',
    (fragment) => {
      expect(isShareLinkFragment(fragment)).toBe(true);
    },
  );

  it.each([
    '',
    '#',
    '#security-properties',
    'share=1.G2QA',
    '#Share=1.G2QA',
    '#shared',
  ])('carries none as %j', (fragment) => {
    expect(isShareLinkFragment(fragment)).toBe(false);
  });
});

describe('a fragment refused before anything is decoded', () => {
  it.each(['', '#security-properties'])(
    'refuses %j as no share link',
    async (fragment) => {
      expect(await readShareLink(fragment, noModule)).toEqual(
        Either.left(ShareLinkFailure.NotAShareLink()),
      );
    },
  );

  it.each(['2', '9999'])(
    'refuses encoding %j, which it does not decode, naming it',
    async (prefix) => {
      expect(await readShareLink(`#share=${prefix}.G2QA`, noModule)).toEqual(
        Either.left(ShareLinkFailure.UnknownEncoding({ prefix })),
      );
    },
  );

  it.each([
    ['nothing after the marker', '#share='],
    ['an encoding and no payload', '#share=1'],
    ['an empty encoding', '#share=.G2QA'],
    ['five digits', '#share=12345.G2QA'],
    ['a letter', '#share=x.G2QA'],
    ['a million letters', `#share=${'x'.repeat(1_000_000)}.A`],
  ])(
    'refuses %s where the encoding number goes as cut off',
    async (_what, fragment) => {
      expect(
        malformedMessage(await readShareLink(fragment, noModule)),
      ).toContain('cut off');
    },
  );

  it('refuses a fragment past the limit as too long', async () => {
    const fragment = `${marker}${'ж'.repeat(4 * shareLinkLimit)}`;
    expect(await readShareLink(fragment, noModule)).toEqual(
      Either.left(
        ShareLinkFailure.TooLong({
          length: fragment.length,
          limit: shareLinkLimit,
        }),
      ),
    );
  });

  it('refuses a character outside the alphabet at the end of a fragment as long as the limit, rather than throwing', async () => {
    const fragment = `${marker}${'A'.repeat(shareLinkLimit - marker.length - 1)}ж`;
    expect(fragment).toHaveLength(shareLinkLimit);
    expect(malformedMessage(await readShareLink(fragment, noModule))).toContain(
      'cut off',
    );
  });
});

describe('a module that will not do the work', () => {
  it('reports a module that would not start, writing', async () => {
    expect(
      Option.getOrUndefined(
        Either.getLeft(
          await writeShareLink(featureComplete, hostedStudioUrl, notAModule),
        ),
      )?._tag,
    ).toBe('Unusable');
  });

  it('reports a module that would not start, reading', async () => {
    expect(
      Option.getOrUndefined(
        Either.getLeft(await readShareLink(`${marker}G2QA`, notAModule)),
      )?._tag,
    ).toBe('Unusable');
  });
});

describe.skipIf(brotliUnbuilt)('every fixture as a link', () => {
  it.each(fixtures)(
    'reads the $name back as the same model, within its density ceiling',
    async ({ name, model }) => {
      const link = await linkOf(model);
      expect(link.startsWith(`${hostedStudioUrl}${marker}`)).toBe(true);
      const density =
        payloadOf(link).length / Buffer.byteLength(savedText(model));
      expect(density).toBeLessThanOrEqual(densityCeilings[name] ?? 0);
      const read = Either.getOrThrow(
        await readShareLink(fragmentOf(link), brotliWasm()),
      );
      expect(read.divergences).toEqual([]);
      expect(read.model).toEqual(withThreatsInNumberOrder(model));
    },
  );

  it('carries the bytes a save writes, as one standard brotli stream in base64url', async () => {
    const payload = payloadOf(await linkOf(featureComplete));
    expect(
      brotliDecompressSync(Buffer.from(payload, 'base64url')).toString('utf8'),
    ).toBe(savedText(featureComplete));
  });

  it('replaces a fragment the base already carries', async () => {
    const link = await linkOf(
      featureComplete,
      `${hostedStudioUrl}#security-properties`,
    );
    expect(link.startsWith(`${hostedStudioUrl}${marker}`)).toBe(true);
  });
});

describe.skipIf(brotliUnbuilt)(
  'a link of hundreds of thousands of characters',
  () => {
    it('writes a link past 400,000 characters and reads it back as the same model', async () => {
      const model = incompressible(300_000);
      const link = await linkOf(model);
      expect(link.length).toBeGreaterThan(400_000);
      expect(
        Either.getOrThrow(await readShareLink(fragmentOf(link), brotliWasm()))
          .model,
      ).toEqual(model);
    });
  },
);

describe('a model past the read bound', () => {
  it('is refused before it is compressed', async () => {
    const model: Model = {
      ...featureComplete,
      metadata: {
        ...featureComplete.metadata,
        description: 'x'.repeat(readLimits.maxTextBytes),
      },
    };
    const refusal = Option.getOrUndefined(
      Either.getLeft(await writeShareLink(model, hostedStudioUrl, noModule)),
    );
    expect(refusal?._tag).toBe('PastReadBound');
    expect(
      ShareLinkFailure.$is('PastReadBound')(refusal) ? refusal.size : 0,
    ).toBeGreaterThan(readLimits.maxTextBytes);
  });
});

describe.skipIf(brotliUnbuilt)('the limit', () => {
  it('counts the base URL, writing an incompressible link of exactly the limit and refusing one character more', async () => {
    const model = incompressible(75_000);
    const fragment = fragmentOf(await linkOf(model));
    const padded = `${hostedStudioUrl}${'x'.repeat(shareLinkLimit - hostedStudioUrl.length - fragment.length)}`;
    expect(await linkOf(model, padded)).toHaveLength(shareLinkLimit);
    expect(await writeShareLink(model, `${padded}x`, brotliWasm())).toEqual(
      Either.left(
        ShareLinkFailure.TooLong({
          length: shareLinkLimit + 1,
          limit: shareLinkLimit,
        }),
      ),
    );
  });
});

describe.skipIf(brotliUnbuilt)('a link read on the path a file takes', () => {
  it('reads a link holding the file v0.2.1 wrote as the model it describes, migrated to version 2', async () => {
    const read = Either.getOrThrow(
      await readShareLink(holding(readFileSync(frozenV021Path)), brotliWasm()),
    );
    expect(read.source.formatVersion).toBe(2);
    expect(read.model).toStrictEqual(parsedFixture(frozenV021Model));
  });

  it('refuses a link holding a YAML alias expansion as the native read refuses the file', async () => {
    const text = adversarialText('alias-expansion.yaml');
    expect(
      await readShareLink(holding(Buffer.from(text)), brotliWasm()),
    ).toEqual(saerskrivenYamlCodec.read(text));
  });
});

describe.skipIf(brotliUnbuilt)('a link that was cut off or changed', () => {
  const fragment = async () => fragmentOf(await linkOf(featureComplete));

  it.each([1, 2, 3, 4, 1000])(
    'refuses a link that lost %i characters from its end as cut off',
    async (lost) => {
      const cut = (await fragment()).slice(0, -lost);
      expect(
        malformedMessage(await readShareLink(cut, brotliWasm())),
      ).toContain('cut off');
    },
  );

  it.each([
    ['a closing parenthesis', (text: string) => `${text})`],
    ['a space', (text: string) => `${text.slice(0, 40)} ${text.slice(40)}`],
    ['a plus sign', (text: string) => `${text.slice(0, 40)}+${text.slice(41)}`],
    ['padding', (text: string) => `${text}==`],
  ])('refuses a link holding %s', async (_what, change) => {
    expect(
      malformedMessage(
        await readShareLink(change(await fragment()), brotliWasm()),
      ),
    ).toContain('cut off');
  });

  it('refuses a stream that inflates to bytes that are not UTF-8 as malformed text', async () => {
    expect(
      Option.getOrUndefined(
        Either.getLeft(
          await readShareLink(
            holding(new Uint8Array([0x66, 0xff, 0xfe])),
            brotliWasm(),
          ),
        ),
      )?._tag,
    ).toBe('MalformedText');
  });

  it('stops decoding 64 MiB of zeros one byte past the text bound, as past the read limit', async () => {
    expect(
      await readShareLink(
        holding(new Uint8Array(8 * readLimits.maxTextBytes)),
        brotliWasm(),
      ),
    ).toEqual(
      Either.left(
        exceededReadLimit('maxTextBytes', readLimits.maxTextBytes + 1),
      ),
    );
  });
});
