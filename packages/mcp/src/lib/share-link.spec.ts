import { saerskrivenYamlCodec } from '@saerskriven/formats';
import { brotliUnbuilt, brotliWasm } from '@saerskriven/formats/fixtures';
import { hostedStudioUrl } from '@saerskriven/formats/hosted-studio';
import {
  readShareLink,
  renderShareLinkWriteFailure,
  shareLinkLimit,
  ShareLinkWriteFailure,
} from '@saerskriven/formats/share-link';
import { inNumberOrder } from '@saerskriven/model';
import { incompressibleModel, validModel } from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { occurrencesIn, shareLinkOf } from '../fixtures.js';
import { brokenBrotli, builtBrotli } from './brotli.fixtures.js';
import {
  answerOf,
  featureCompleteFile,
  featureCompleteWorkspace,
  invalidFile,
  refusalOf,
  treeHolding,
  unreadableTree,
} from './read-tools.fixtures.js';
import { dataNotInstructions } from './preface.js';
import { readNamed } from './reading.js';
import { noBrotli } from './server.fixtures.js';
import {
  renderShareLink,
  shareLink,
  shareLinkDescription,
  type SharedLink,
} from './share-link.js';
import { attachedToolResult } from './tool-result.js';
import { validate } from './validate.js';
import { workspaceTree } from './workspace.fixtures.js';
import { openWorkspace } from './workspace.js';

const workspace = featureCompleteWorkspace();

const linkIn = (shared: SharedLink): string => {
  const [block] = shared.blocks;
  return block?.type === 'text' ? (block.text.split('\n').at(-1) ?? '') : '';
};

const textsOf = (result: CallToolResult): readonly string[] =>
  result.content.flatMap((block) =>
    block.type === 'text' ? [block.text] : [],
  );

describe('what saer_share_link tells a client', () => {
  it('states the longest link its result can hold', () => {
    expect(shareLinkDescription).toContain(String(shareLinkLimit));
  });
});

describe('what saer_share_link refuses', () => {
  it('names the reason where this install carries no brotli module', async () => {
    const missing = Either.getOrThrow(Either.flip(noBrotli()));
    const refused = refusalOf(await shareLink(workspace, noBrotli, {}));
    expect(refused[0]).toContain('cannot write a share link');
    expect(refused[0]).toContain(missing);
  });

  it('words what the module refused where it will not start', async () => {
    const refused = refusalOf(await shareLink(workspace, brokenBrotli, {}));
    expect(refused).toHaveLength(1);
    expect(refused[0]).toContain('did not run');
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
    const link = linkIn(shared);
    expect(link.startsWith(`${hostedStudioUrl}#share=1.`)).toBe(true);
    const read = Either.getOrThrow(
      await readShareLink(new URL(link).hash, brotliWasm()),
    );
    expect(read.model).toEqual({
      ...reading.model,
      threats: inNumberOrder(reading.model.threats),
    });
    expect(shared.answer).toEqual({
      file: featureCompleteFile,
      format: 'threat-dragon',
      revision: reading.revision,
      length: link.length,
      divergences: reading.divergences,
    });
  });

  it('carries the link once in the whole result, alone on the line after the data line of a block of its own', async () => {
    const outcome = await shareLink(workspace, builtBrotli, {});
    const link = linkIn(answerOf(outcome));
    const result = attachedToolResult(outcome, renderShareLink);
    expect(textsOf(result).map((text) => text.split('\n')[0])).toEqual([
      dataNotInstructions,
      dataNotInstructions,
    ]);
    expect(textsOf(result)[1]?.split('\n')).toEqual([
      dataNotInstructions,
      link,
    ]);
    expect(shareLinkOf(result)).toEqual(link);
    expect(occurrencesIn(result, link)).toBe(1);
  });

  it('names the link in its text by its length, after the reading', async () => {
    const shared = answerOf(await shareLink(workspace, builtBrotli, {}));
    const rendered = renderShareLink(shared.answer);
    expect(rendered[0]).toEqual(`file: ${featureCompleteFile}`);
    expect(
      rendered.filter((line) => line.includes(String(shared.answer.length))),
    ).toHaveLength(1);
  });

  it('refuses a model whose link would pass the limit, naming both lengths and the file as the thing to send', async () => {
    const oversized = treeHolding(
      saerskrivenYamlCodec.write(incompressibleModel(validModel, 800_000))
        .output,
    );
    const refused = refusalOf(await shareLink(oversized, builtBrotli, {}));
    const [length] = /\d{7,}/u.exec(refused[0] ?? '') ?? [];
    expect(Number(length)).toBeGreaterThan(shareLinkLimit);
    expect(refused).toEqual(
      renderShareLinkWriteFailure(
        ShareLinkWriteFailure.TooLong({
          length: Number(length),
          limit: shareLinkLimit,
        }),
      ),
    );
  });
});
