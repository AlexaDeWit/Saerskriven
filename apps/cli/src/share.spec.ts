import { saerskrivenYamlCodec } from '@saerskriven/formats';
import {
  hostedStudioUrl,
  shareLinkLimit,
} from '@saerskriven/formats/share-link';
import { unclaimedYaml } from '@saerskriven/mcp/fixtures';
import {
  committedText,
  incompressibleModel,
  testDataPath,
  validModel,
} from '@saerskriven/model/fixtures';
import {
  brokenDocumentYaml,
  builtAssets,
  fakeAssets,
  fixtureFile,
  scratchDirectory,
} from './cli.fixtures.js';
import { modelIn, modelOf } from './share.fixtures.js';
import { share } from './share.js';
import { validate } from './validate.js';

const directory = scratchDirectory('share');

const prefix = `${hostedStudioUrl}#share=1.`;

describe('share', () => {
  it('prints a link to the hosted studio on one line, which reads back as the model of the file', async () => {
    const outcome = await share(
      testDataPath('saerskriven/two-diagrams.yaml'),
      builtAssets,
    );
    const [link] = String(outcome.out).split('\n');
    expect({ code: outcome.code, err: outcome.err }).toEqual({
      code: 0,
      err: '',
    });
    expect(String(outcome.out).split('\n')).toEqual([link, '']);
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

  it('writes no link past the length a link holds, and exits 2 on one line naming the length, the limit and the file as the thing to send', async () => {
    const file = fixtureFile(
      directory,
      'oversized.yaml',
      saerskrivenYamlCodec.write(incompressibleModel(validModel, 800_000))
        .output,
    );
    const outcome = await share(file, builtAssets);
    const [length] = /\d{7,}/u.exec(outcome.err) ?? [];
    expect(Number(length)).toBeGreaterThan(shareLinkLimit);
    expect(outcome).toEqual({
      code: 2,
      out: '',
      err: `error: the link would be ${String(length)} characters, past the 1048576 a share link may hold, so none was written. Send the file itself instead.\n`,
    });
  });

  it('exits 2 on one line saying the module did not run, where it will not start', async () => {
    const outcome = await share(
      testDataPath('saerskriven/two-diagrams.yaml'),
      fakeAssets(scratchDirectory('share-broken')),
    );
    expect({ code: outcome.code, out: outcome.out }).toEqual({
      code: 2,
      out: '',
    });
    expect(
      outcome.err.startsWith(
        'error: the brotli module a link is compressed with did not run: ',
      ),
    ).toBe(true);
    expect(outcome.err.split('\n')).toHaveLength(2);
  });

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
