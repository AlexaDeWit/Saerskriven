import {
  ProtocolError,
  isInputRequiredResult,
} from '@modelcontextprotocol/client';
import { Either } from 'effect';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  editOf,
  eras,
  readingOf,
  registeredTools,
  textOf,
  type McpSession,
} from '../fixtures.js';
import {
  modelFile,
  otmFile,
  renaming,
  staleRevision,
} from './edit.fixtures.js';
import {
  hostTree,
  insideFile,
  listingHost,
} from './host-directories.fixtures.js';
import {
  listedDirectories,
  rootsRequestKey,
  workspaceForCall,
  type HostTurn,
} from './host-directories.js';
import { revisionOf } from './revision.js';
import { session } from './server.fixtures.js';
import {
  HostDirectories,
  WorkspaceFailure,
  openWorkspace,
  renderWorkspaceFailure,
  type Reach,
} from './workspace.js';
import { WriteFailure, renderWriteFailure } from './write.js';

const uriOf = (path: string): string => pathToFileURL(path).href;

const answering = (...uris: readonly unknown[]) => ({
  [rootsRequestKey]: { roots: uris.map((uri) => ({ uri })) },
});

describe('the directories a roots answer names', () => {
  const tree = hostTree();
  writeFileSync(join(tree.listed, 'notes.txt'), 'not a directory');

  it('counts a file URI by the real path of the directory it resolves to', () => {
    expect(
      listedDirectories({
        roots: [{ uri: uriOf(tree.alias) }, { uri: uriOf(tree.unlisted) }],
      }),
    ).toEqual(
      HostDirectories.Listed({ directories: [tree.listed, tree.unlisted] }),
    );
  });

  it.each([
    ['a URI of another scheme', { uri: `https://example.com${tree.listed}` }],
    [
      'a file URI on another machine',
      { uri: `file://elsewhere${tree.listed}` },
    ],
    ['a path that is no URI', { uri: tree.listed }],
    ['a file', { uri: uriOf(join(tree.listed, 'notes.txt')) }],
    [
      'a directory that is not there',
      { uri: uriOf(join(tree.listed, 'gone')) },
    ],
    ['an entry naming no URI', { name: tree.listed }],
    ['an entry whose URI is no text', { uri: 7 }],
    ['an entry that is no object', tree.listed],
  ])('passes over %s and keeps the entries beside it', (_what, entry) => {
    expect(
      listedDirectories({ roots: [entry, { uri: uriOf(tree.listed) }] }),
    ).toEqual(HostDirectories.Listed({ directories: [tree.listed] }));
  });

  it.each([
    ['nothing', undefined],
    ['an object naming no roots', {}],
    ['roots that are no list', { roots: uriOf(tree.listed) }],
    ['a bare list', [{ uri: uriOf(tree.listed) }]],
  ])('takes %s as no answer', (_what, answer) => {
    expect(listedDirectories(answer)).toEqual(HostDirectories.Unanswered());
  });
});

describe('the workspace one call runs against', () => {
  const tree = hostTree();
  const outside = join(tree.listed, modelFile);
  const opened = (reach: Reach) =>
    Either.getOrThrow(openWorkspace({ root: tree.launch, reach }));
  const following = opened('host');
  const asking: HostTurn = { declaresRoots: true, responses: undefined };
  const answered: HostTurn = {
    declaresRoots: true,
    responses: answering(uriOf(tree.listed)),
  };

  it('is the workspace as opened where every path stays under the root, whatever the request carries', () => {
    expect(
      workspaceForCall(following, [insideFile, undefined], answered),
    ).toEqual(Either.right(following));
  });

  it('is a round of one roots/list request where a path leaves the root and nothing was answered', () => {
    expect(
      Either.getOrUndefined(
        Either.flip(workspaceForCall(following, [insideFile, outside], asking)),
      )?.inputRequests,
    ).toEqual({ [rootsRequestKey]: { method: 'roots/list' } });
  });

  it('carries the directories a retried request answers with, and asks no second time', () => {
    expect(workspaceForCall(following, [outside], answered)).toEqual(
      Either.right({
        ...following,
        host: HostDirectories.Listed({ directories: [tree.listed] }),
      }),
    );
  });

  it('is refused rather than asked again where the retried request carries no list', () => {
    expect(
      workspaceForCall(following, [outside], {
        declaresRoots: true,
        responses: {},
      }),
    ).toEqual(
      Either.right({ ...following, host: HostDirectories.Unanswered() }),
    );
  });

  it('asks nothing of a host that declares no roots, and reads no answer from it', () => {
    expect(
      workspaceForCall(following, [outside], {
        declaresRoots: false,
        responses: answered.responses,
      }),
    ).toEqual(
      Either.right({ ...following, host: HostDirectories.Undeclared() }),
    );
  });

  it.each(['pinned', 'http'] as const)(
    'is the workspace as opened for a %s server, which neither asks nor reads an answer',
    (reach) => {
      expect(
        [asking, answered].map((turn) =>
          workspaceForCall(opened(reach), [outside], turn),
        ),
      ).toEqual([Either.right(opened(reach)), Either.right(opened(reach))]);
    },
  );
});

const calling = (
  open: McpSession,
  name: string,
  args: Record<string, unknown>,
) => open.client.callTool({ name, arguments: args });

const callingWithAnswer = (
  open: McpSession,
  name: string,
  args: Record<string, unknown>,
  inputResponses: Record<string, unknown>,
) =>
  open.client.request({
    method: 'tools/call',
    params: { name, arguments: args, inputResponses },
  });

const refusal = (
  requested: string,
  root: string,
  host: HostDirectories,
): string =>
  renderWorkspaceFailure(
    WorkspaceFailure.OutsideRoot({
      requested,
      resolved: requested,
      root,
      host,
    }),
  ).join('\n');

describe.each(eras)('a %s client of a server that follows its host', (era) => {
  it('reads a model in a listed directory under its absolute path, and edits it by that spelling', async () => {
    const tree = hostTree();
    const host = listingHost(tree.launch, tree.listed);
    const path = join(tree.listed, modelFile);
    const open = await session({
      root: tree.launch,
      reach: 'host',
      era,
      roots: host.roots,
    });
    const read = readingOf(await calling(open, 'saer_inspect', { file: path }));
    const edited = editOf(
      await calling(open, 'saer_edit', {
        file: read.file,
        revision: read.revision,
        edits: [renaming],
      }),
    );
    const negotiated = open.client.getProtocolEra();
    await open.end();
    expect({
      negotiated,
      read: read.file,
      edited: edited.file,
      onDisk: revisionOf(readFileSync(path)),
    }).toEqual({
      negotiated: era,
      read: path,
      edited: path,
      onDisk: edited.revision,
    });
  });

  it('asks the host on every call that leaves the root, and on none that stays under it', async () => {
    const tree = hostTree();
    const host = listingHost(tree.listed);
    const open = await session({
      root: tree.launch,
      reach: 'host',
      era,
      roots: host.roots,
    });
    const asked: number[] = [];
    for (const file of [
      insideFile,
      join(tree.launch, insideFile),
      join(tree.listed, modelFile),
      join(tree.listed, modelFile),
    ]) {
      await calling(open, 'saer_inspect', { file });
      asked.push(host.asked());
    }
    await open.end();
    expect(asked).toEqual([0, 0, 1, 2]);
  });

  describe('every argument that names a path', () => {
    const tree = hostTree();
    const host = listingHost(tree.listed);
    const outside = join(tree.listed, modelFile);
    const rows: readonly (readonly [
      string,
      string,
      Record<string, unknown>,
    ])[] = [
      ['file', 'saer_inspect', { file: outside }],
      ['file', 'saer_validate', { file: outside }],
      ['file', 'saer_coverage', { file: outside }],
      ['file', 'saer_register', { file: outside }],
      ['file', 'saer_search_elements', { file: outside }],
      ['file', 'saer_search_threats', { file: outside }],
      ['file', 'saer_search_records', { file: outside }],
      ['file', 'saer_get_threat', { file: outside, ref: '1' }],
      ['file', 'saer_render_diagram', { file: outside }],
      [
        'out',
        'saer_render_diagram',
        { file: insideFile, out: join(tree.listed, 'drawn.png') },
      ],
      ['file', 'saer_share_link', { file: outside }],
      [
        'file',
        'saer_edit',
        { file: outside, revision: staleRevision, edits: [renaming] },
      ],
      [
        'file',
        'saer_create',
        { file: join(tree.listed, 'started.yaml'), title: 'Started' },
      ],
      [
        'file',
        'saer_import',
        { file: join(tree.listed, otmFile), target: 'from-outside.yaml' },
      ],
      [
        'target',
        'saer_import',
        { file: otmFile, target: join(tree.listed, 'converted.yaml') },
      ],
    ];
    let open: McpSession;

    beforeAll(async () => {
      open = await session({
        root: tree.launch,
        reach: 'host',
        era,
        roots: host.roots,
      });
    });

    afterAll(() => open.end());

    it('has a row for every tool the server offers', () => {
      expect(new Set(rows.map(([, name]) => name))).toEqual(
        new Set(registeredTools),
      );
    });

    it.each(rows)(
      'asks the host once where `%s` of %s leaves the root',
      async (_argument, name, args) => {
        const before = host.asked();
        await calling(open, name, args);
        expect(host.asked() - before).toBe(1);
      },
    );
  });

  it('refuses a path no listed directory holds, with where it resolved, the root and the listing', async () => {
    const tree = hostTree();
    const host = listingHost(tree.launch, tree.listed);
    const requested = join(tree.unlisted, modelFile);
    const open = await session({
      root: tree.launch,
      reach: 'host',
      era,
      roots: host.roots,
    });
    const result = await calling(open, 'saer_inspect', { file: requested });
    await open.end();
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(
      refusal(
        requested,
        tree.launch,
        HostDirectories.Listed({ directories: [tree.launch, tree.listed] }),
      ),
    );
  });

  it('holds a write in a listed directory to the revision it quotes and to a free path', async () => {
    const tree = hostTree();
    const host = listingHost(tree.listed);
    const path = join(tree.listed, modelFile);
    const before = readFileSync(path);
    const open = await session({
      root: tree.launch,
      reach: 'host',
      era,
      roots: host.roots,
    });
    const taken = await calling(open, 'saer_create', {
      file: path,
      title: 'Taken',
    });
    const stale = await calling(open, 'saer_edit', {
      file: path,
      revision: staleRevision,
      edits: [renaming],
    });
    await open.end();
    expect(textOf(taken)).toContain(
      renderWriteFailure(WriteFailure.Occupied({ file: path })).join('\n'),
    );
    expect(textOf(stale)).toContain(
      renderWriteFailure(
        WriteFailure.StaleRevision({
          file: path,
          quoted: staleRevision,
          found: revisionOf(before),
        }),
      ).join('\n'),
    );
    expect(readFileSync(path)).toEqual(before);
  });

  it('refuses after one round where the host lists nothing, and writes nothing', async () => {
    const tree = hostTree();
    const host = listingHost();
    const path = join(tree.listed, 'started.yaml');
    const open = await session({
      root: tree.launch,
      reach: 'host',
      era,
      roots: host.roots,
    });
    const result = await calling(open, 'saer_create', {
      file: path,
      title: 'Started',
    });
    await open.end();
    expect(textOf(result)).toContain(
      refusal(path, tree.launch, HostDirectories.Listed({ directories: [] })),
    );
    expect({ asked: host.asked(), written: existsSync(path) }).toEqual({
      asked: 1,
      written: false,
    });
  });

  it('refuses an answer that is no list without asking for another, and writes nothing', async () => {
    const tree = hostTree();
    const host = listingHost(tree.listed);
    const path = join(tree.listed, 'started.yaml');
    const open = await session({
      root: tree.launch,
      reach: 'host',
      era,
      roots: host.roots,
    });
    const result = await callingWithAnswer(
      open,
      'saer_create',
      { file: path, title: 'Started' },
      { [rootsRequestKey]: { roots: uriOf(tree.listed) } },
    );
    await open.end();
    expect(textOf(result)).toContain(
      refusal(path, tree.launch, HostDirectories.Unanswered()),
    );
    expect({ asked: host.asked(), written: existsSync(path) }).toEqual({
      asked: 0,
      written: false,
    });
  });

  it('refuses without a round where the host declares no roots, and writes nothing', async () => {
    const tree = hostTree();
    const path = join(tree.listed, 'started.yaml');
    const open = await session({ root: tree.launch, reach: 'host', era });
    const result = await open.client.callTool(
      { name: 'saer_create', arguments: { file: path, title: 'Started' } },
      { allowInputRequired: true },
    );
    await open.end();
    expect(isInputRequiredResult(result)).toBe(false);
    expect(textOf(result)).toContain(
      refusal(path, tree.launch, HostDirectories.Undeclared()),
    );
    expect(existsSync(path)).toBe(false);
  });

  it.each([
    ['pinned', HostDirectories.Pinned()],
    ['http', HostDirectories.OverHttp()],
  ] as const)(
    'never asks from a %s server, and reads no answer sent anyway',
    async (reach, unextended) => {
      const tree = hostTree();
      const host = listingHost(tree.listed);
      const path = join(tree.listed, 'started.yaml');
      const args = { file: path, title: 'Started' };
      const open = await session({
        root: tree.launch,
        reach,
        era,
        roots: host.roots,
      });
      const results = [
        await calling(open, 'saer_create', args),
        await callingWithAnswer(
          open,
          'saer_create',
          args,
          answering(uriOf(tree.listed)),
        ),
      ];
      await open.end();
      for (const result of results) {
        expect(textOf(result)).toContain(
          refusal(path, tree.launch, unextended),
        );
      }
      expect({ asked: host.asked(), written: existsSync(path) }).toEqual({
        asked: 0,
        written: false,
      });
    },
  );

  describe('a prompt naming a file beyond the root', () => {
    const tree = hostTree();
    const file = join(tree.listed, modelFile);
    const prompts: readonly {
      readonly name: string;
      readonly arguments: Record<string, string>;
    }[] = [
      { name: 'review_model', arguments: { file } },
      { name: 'stride_pass', arguments: { file, element: 'element-db' } },
    ];

    it('is built from a model in a listed directory, the host asked once for each', async () => {
      const host = listingHost(tree.listed);
      const open = await session({
        root: tree.launch,
        reach: 'host',
        era,
        roots: host.roots,
      });
      const built = [];
      for (const prompt of prompts) {
        built.push((await open.client.getPrompt(prompt)).messages.length);
      }
      await open.end();
      expect({ built, asked: host.asked() }).toEqual({
        built: [2, 2],
        asked: 2,
      });
    });

    it('is refused as invalid params where the host declares no roots', async () => {
      const open = await session({ root: tree.launch, reach: 'host', era });
      const codes = [];
      for (const prompt of prompts) {
        codes.push(
          await open.client.getPrompt(prompt).then(
            () => 'the prompt was built',
            (error: unknown) =>
              error instanceof ProtocolError ? error.code : error,
          ),
        );
      }
      await open.end();
      expect(codes).toEqual([-32602, -32602]);
    });
  });
});

describe('the first answer to a 2026-07-28 call that leaves the root', () => {
  it('is input_required with one roots/list request, and nothing is written in that round', async () => {
    const tree = hostTree();
    const host = listingHost(tree.listed);
    const path = join(tree.listed, 'started.yaml');
    const open = await session({
      root: tree.launch,
      reach: 'host',
      era: 'modern',
      roots: host.roots,
    });
    const first = await open.client.callTool(
      { name: 'saer_create', arguments: { file: path, title: 'Started' } },
      { allowInputRequired: true },
    );
    await open.end();
    expect(isInputRequiredResult(first) ? first.inputRequests : first).toEqual({
      [rootsRequestKey]: { method: 'roots/list' },
    });
    expect({ asked: host.asked(), written: existsSync(path) }).toEqual({
      asked: 0,
      written: false,
    });
  });
});
