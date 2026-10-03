import { saerskrivenYamlCodec } from '@saerskriven/formats';
import {
  hostedStudioUrl,
  shareLinkLimit,
} from '@saerskriven/formats/share-link';
import { unclaimedYaml } from '@saerskriven/mcp/fixtures';
import {
  committedText,
  incompressibleModel,
  oversizedLinkTimeout,
  testDataPath,
  validModel,
} from '@saerskriven/model/fixtures';
import {
  brokenDocumentYaml,
  builtAssets,
  fixtureFile,
  scratchDirectory,
} from './cli.fixtures.js';
import { modelIn, modelOf } from './share.fixtures.js';
import { share } from './share.js';
import { validate } from './validate.js';

const directory = scratchDirectory('share');

const prefix = `${hostedStudioUrl}#share=1.`;

const refusedLength =
  /^error: the link would be (\d+) characters, past the (\d+) /u;

describe('share', () => {
  it('prints a link to the hosted studio on one line, which reads back as the model of the file', async () => {
    const outcome = await share(
      testDataPath('saerskriven/two-diagrams.yaml'),
      builtAssets,
    );
    const [link, rest] = String(outcome.out).split('\n');
    expect({ code: outcome.code, err: outcome.err, rest }).toEqual({
      code: 0,
      err: '',
      rest: '',
    });
    expect(link?.startsWith(prefix)).toBe(true);
    expect(await modelIn(link ?? '')).toEqual(
      modelOf(committedText('saerskriven/two-diagrams.yaml')),
    );
  });

  it('reads a Threat Dragon file, and warns on standard error as validate does of what the read reduced', async () => {
    const file = testDataPath('threat-dragon/feature-complete.json');
    const outcome = await share(file, builtAssets);
    expect(outcome.code).toEqual(0);
    expect(outcome.err).toContain('warning: ');
    expect(outcome.err).toEqual(validate(file).err);
    expect(await modelIn(String(outcome.out).trimEnd())).toEqual(
      modelOf(committedText('threat-dragon/feature-complete.json')),
    );
  });

  it.each([
    ['a document its format refuses', 'broken.yaml', brokenDocumentYaml],
    ['a text no format claims', 'unclaimed.yaml', unclaimedYaml],
  ])('fails on %s as validate fails on it', async (_what, name, text) => {
    const file = fixtureFile(directory, name, text);
    const outcome = await share(file, builtAssets);
    expect(outcome.code).toEqual(1);
    expect(outcome).toEqual(validate(file));
  });

  it('fails on a file it cannot read as validate fails on it', async () => {
    const file = testDataPath('absent.json');
    const outcome = await share(file, builtAssets);
    expect(outcome.code).toEqual(2);
    expect(outcome).toEqual(validate(file));
  });

  it(
    'writes no link past the length a link holds, and exits 2 naming the length, the limit and the file as the thing to send',
    async () => {
      const file = fixtureFile(
        directory,
        'oversized.yaml',
        saerskrivenYamlCodec.write(incompressibleModel(validModel, 800_000))
          .output,
      );
      const outcome = await share(file, builtAssets);
      const [, length, limit] = refusedLength.exec(outcome.err) ?? [];
      expect({ code: outcome.code, out: outcome.out }).toEqual({
        code: 2,
        out: '',
      });
      expect(Number(length)).toBeGreaterThan(shareLinkLimit);
      expect(Number(limit)).toEqual(shareLinkLimit);
      expect(outcome.err).toContain('Send the file itself instead.');
      expect(outcome.err.split('\n')).toHaveLength(2);
    },
    oversizedLinkTimeout,
  );

  it('exits 2 saying why where the install carries no brotli module', async () => {
    const outcome = await share(
      testDataPath('saerskriven/two-diagrams.yaml'),
      scratchDirectory('share-bare'),
    );
    expect({ code: outcome.code, out: outcome.out }).toEqual({
      code: 2,
      out: '',
    });
    expect(outcome.err.startsWith('error: cannot write the link: ')).toBe(true);
  });
});
