import type { Model } from '@saerskriven/model';
import { Either } from 'effect';
import { createHash } from 'node:crypto';
import { brotliCompressSync, constants } from 'node:zlib';
import { brotliUnbuilt, brotliWasm } from './brotli.fixtures.js';
import type { ReadFailure } from './lib/codec.js';
import { vendoredTexts } from './lib/corpus.fixtures.js';
import { exceededReadLimit, readLimits } from './lib/read-limits.js';
import {
  featureCompleteYaml,
  nativeFixtures,
  withThreatsInNumberOrder,
} from './lib/saerskriven-yaml.fixtures.js';
import { saerskrivenYamlCodec } from './lib/saerskriven-yaml.js';
import { threatDragonReading } from './lib/threat-dragon.fixtures.js';
import {
  isShareLinkFragment,
  readShareLink,
  ShareLinkFailure,
  shareLinkLimit,
  writeShareLink,
} from './share-link.js';

const studio = 'https://saerskriven.com/';

const marker = '#share=1.';

const noModule = new Uint8Array(0);

const notAModule = new Uint8Array([1, 2, 3]);

const nativeModel = (text: string): Model =>
  Either.getOrThrow(saerskrivenYamlCodec.read(text)).model;

const featureComplete = nativeModel(featureCompleteYaml);

const fixtures: readonly { name: string; model: Model }[] = [
  ...nativeFixtures.map(({ name, text }) => ({
    name,
    model: nativeModel(text),
  })),
  ...vendoredTexts(['threat-dragon/demo'], (name) =>
    name.endsWith('.json'),
  ).map(({ name, text }) => ({ name, model: threatDragonReading(text).model })),
];

const budgets: Readonly<Record<string, number>> = {
  'feature-complete file': 4300,
  'two-diagram file': 3000,
  'Saerskriven model': 20_500,
  'threat-dragon/demo/cryptocurrency-wallet.json': 3300,
  'threat-dragon/demo/generic-cms.json': 1650,
  'threat-dragon/demo/iot-device.json': 3300,
  'threat-dragon/demo/online-game.json': 2800,
  'threat-dragon/demo/payment-online.json': 2250,
  'threat-dragon/demo/renting-car.json': 2900,
  'threat-dragon/demo/three-tier-web-app.json': 1650,
  'threat-dragon/demo/v2-new-model.json': 420,
  'threat-dragon/demo/v2-threat-model.json': 4400,
};

const linkOf = async (model: Model, base = studio): Promise<string> =>
  Either.getOrThrow(await writeShareLink(model, base, brotliWasm()));

const fragmentOf = (link: string): string => new URL(link).hash;

const refusalOf = (
  outcome: Either.Either<unknown, ShareLinkFailure | ReadFailure>,
): ShareLinkFailure | ReadFailure | undefined =>
  Either.isLeft(outcome) ? outcome.left : undefined;

const malformedMessage = (
  outcome: Either.Either<unknown, ShareLinkFailure | ReadFailure>,
): string | undefined => {
  const refusal = refusalOf(outcome);
  return ShareLinkFailure.$is('Malformed')(refusal)
    ? refusal.message
    : undefined;
};

const zerosBomb = (): string =>
  brotliCompressSync(new Uint8Array(8 * readLimits.maxTextBytes), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 4 },
  }).toString('base64url');

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

  it('refuses a prefix it does not decode, naming it', async () => {
    expect(await readShareLink('#share=2.G2QA', noModule)).toEqual(
      Either.left(ShareLinkFailure.UnknownEncoding({ prefix: '2' })),
    );
  });

  it.each(['#share=', '#share=1'])(
    'refuses %j, which ends before a payload, as cut off',
    async (fragment) => {
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
      refusalOf(await writeShareLink(featureComplete, studio, notAModule))
        ?._tag,
    ).toBe('Unusable');
  });

  it('reports a module that would not start, reading', async () => {
    expect(
      refusalOf(await readShareLink(`${marker}G2QA`, notAModule))?._tag,
    ).toBe('Unusable');
  });
});

describe.skipIf(brotliUnbuilt)('every fixture as a link', () => {
  it.each(fixtures)(
    'reads the $name back as the same model, within its length budget',
    async ({ name, model }) => {
      const link = await linkOf(model);
      expect(link.startsWith(`${studio}${marker}`)).toBe(true);
      expect(link.length).toBeLessThanOrEqual(budgets[name] ?? 0);
      const read = Either.getOrThrow(
        await readShareLink(fragmentOf(link), brotliWasm()),
      );
      expect(read.divergences).toEqual([]);
      expect(read.model).toEqual(withThreatsInNumberOrder(model));
    },
  );

  it('replaces a fragment the base already carries', async () => {
    const link = await linkOf(featureComplete, `${studio}#security-properties`);
    expect(link.startsWith(`${studio}${marker}`)).toBe(true);
  });
});

describe.skipIf(brotliUnbuilt)(
  'a link of hundreds of thousands of characters',
  () => {
    it('writes a link past 400,000 characters and reads it back as the same model', async () => {
      const model: Model = {
        ...featureComplete,
        metadata: {
          ...featureComplete.metadata,
          description: createHash('shake256', { outputLength: 300_000 })
            .update('share-link')
            .digest('base64'),
        },
      };
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
  it('refuses a model whose native text is past the read bound before compressing it', async () => {
    const model: Model = {
      ...featureComplete,
      metadata: {
        ...featureComplete.metadata,
        description: 'x'.repeat(readLimits.maxTextBytes),
      },
    };
    const refusal = refusalOf(await writeShareLink(model, studio, noModule));
    expect(refusal?._tag).toBe('PastReadBound');
    expect(
      ShareLinkFailure.$is('PastReadBound')(refusal) ? refusal.size : 0,
    ).toBeGreaterThan(readLimits.maxTextBytes);
  });
});

describe.skipIf(brotliUnbuilt)('the limit', () => {
  it('counts the base URL, writing a link of exactly the limit and refusing one character more', async () => {
    const fragment = fragmentOf(await linkOf(featureComplete));
    const padded = `${studio}${'x'.repeat(shareLinkLimit - studio.length - fragment.length)}`;
    const atLimit = await linkOf(featureComplete, padded);
    expect(atLimit).toHaveLength(shareLinkLimit);
    expect(
      await writeShareLink(featureComplete, `${padded}x`, brotliWasm()),
    ).toEqual(
      Either.left(
        ShareLinkFailure.TooLong({
          length: shareLinkLimit + 1,
          limit: shareLinkLimit,
        }),
      ),
    );
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
    const stream = brotliCompressSync(new Uint8Array([0x66, 0xff, 0xfe]));
    expect(
      refusalOf(
        await readShareLink(
          `${marker}${stream.toString('base64url')}`,
          brotliWasm(),
        ),
      )?._tag,
    ).toBe('MalformedText');
  });

  it('stops decoding 64 MiB of zeros one byte past the text bound, as past the read limit', async () => {
    expect(
      await readShareLink(`${marker}${zerosBomb()}`, brotliWasm()),
    ).toEqual(
      Either.left(
        exceededReadLimit('maxTextBytes', readLimits.maxTextBytes + 1),
      ),
    );
  });
});
