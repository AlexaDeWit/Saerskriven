import { saerskrivenYamlCodec } from '@saerskriven/formats';
import {
  hostedStudioUrl,
  readShareLink,
  shareLinkLimit,
} from '@saerskriven/formats/share-link';
import { inNumberOrder } from '@saerskriven/model';
import {
  incompressibleModel,
  oversizedLinkTimeout,
  validModel,
} from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import {
  brokenBrotli,
  brotliUnbuilt,
  brotliWasm,
  builtBrotli,
} from './brotli.fixtures.js';
import {
  answerOf,
  featureCompleteFile,
  featureCompleteWorkspace,
  invalidFile,
  refusalOf,
  treeHolding,
  unreadableTree,
} from './read-tools.fixtures.js';
import { readNamed } from './reading.js';
import { noBrotli } from './server.fixtures.js';
import { renderShareLink, shareLink } from './share-link.js';
import { validate } from './validate.js';
import { workspaceTree } from './workspace.fixtures.js';
import { openWorkspace } from './workspace.js';

const workspace = featureCompleteWorkspace();

describe('what saer_share_link refuses', () => {
  it('names the reason where this install carries no brotli module', async () => {
    const missing = Either.getOrThrow(Either.flip(noBrotli()));
    const refused = refusalOf(await shareLink(workspace, noBrotli, {}));
    expect(refused[0]).toContain('cannot write a share link');
    expect(refused[0]).toContain(missing);
  });

  it('words what the module refused where it will not start', async () => {
    const refused = refusalOf(await shareLink(workspace, brokenBrotli, {}));
    expect(refused[0]).toContain('cannot write a share link');
    expect(refused[0]).toContain('WebAssembly');
  });

  it('refuses a file outside the root before it asks for the module', async () => {
    const confined = Either.getOrThrow(
      openWorkspace({ root: workspaceTree().root }),
    );
    expect(
      refusalOf(
        await shareLink(confined, noBrotli, { file: '../outside.yaml' }),
      )[0],
    ).toContain('is outside the root this server may read');
  });

  it('refuses a file that does not read as saer_validate refuses it', async () => {
    const unreadable = unreadableTree();
    expect(
      await shareLink(unreadable, noBrotli, { file: invalidFile }),
    ).toEqual(validate(unreadable, { file: invalidFile }));
  });
});

describe.skipIf(brotliUnbuilt)('what saer_share_link writes', () => {
  it('writes a link on the hosted studio that reads back as the model of the file', async () => {
    const reading = answerOf(readNamed(workspace, undefined));
    const shared = answerOf(await shareLink(workspace, builtBrotli, {}));
    expect(shared.link.startsWith(`${hostedStudioUrl}#share=1.`)).toBe(true);
    const read = Either.getOrThrow(
      await readShareLink(new URL(shared.link).hash, brotliWasm()),
    );
    expect(read.model).toEqual({
      ...reading.model,
      threats: inNumberOrder(reading.model.threats),
    });
    expect({
      file: shared.file,
      format: shared.format,
      revision: shared.revision,
      divergences: shared.divergences,
    }).toEqual({
      file: featureCompleteFile,
      format: 'threat-dragon',
      revision: reading.revision,
      divergences: reading.divergences,
    });
  });

  it('carries the link in its text, after the reading', async () => {
    const shared = answerOf(await shareLink(workspace, builtBrotli, {}));
    const rendered = renderShareLink(shared);
    expect(rendered[0]).toEqual(`file: ${featureCompleteFile}`);
    expect(rendered).toContain(`link: ${shared.link}`);
  });

  it(
    'refuses a model whose link would pass the limit, naming both lengths and the file as the thing to send',
    async () => {
      const oversized = treeHolding(
        saerskrivenYamlCodec.write(incompressibleModel(validModel, 800_000))
          .output,
      );
      const refused = refusalOf(await shareLink(oversized, builtBrotli, {}));
      const [length] = /\d{7,}/u.exec(refused[0] ?? '') ?? [];
      expect(Number(length)).toBeGreaterThan(shareLinkLimit);
      expect(refused[0]).toContain(`past the ${String(shareLinkLimit)} `);
      expect(refused.join('\n')).toContain('Send the file');
    },
    oversizedLinkTimeout,
  );
});
