import { DetectionFailure, renderReadFailure } from '@saerskriven/formats';
import { Either } from 'effect';
import { realpathSync, rmSync, symlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import { modelFile } from './edit.fixtures.js';
import { hostTree, insideFile, leakFile } from './host-directories.fixtures.js';
import { namedPipeIn, workspaceTree } from './workspace.fixtures.js';
import {
  HostDirectories,
  WorkspaceFailure,
  confined,
  namedModel,
  openWorkspace,
  readModelFile,
  reasonOf,
  renderWorkspaceFailure,
  resultPath,
  type ModelWorkspace,
} from './workspace.js';

const tree = workspaceTree();

const opened = (file?: string): ModelWorkspace => {
  const workspace = openWorkspace({ root: tree.root, file });
  if (Either.isLeft(workspace)) {
    throw new Error(renderWorkspaceFailure(workspace.left).join('\n'));
  }
  return workspace.right;
};

const workspace = opened();

const failureOf = (requested: string): WorkspaceFailure => {
  const read = readModelFile(workspace, requested);
  if (Either.isRight(read)) {
    throw new Error(`${requested} was read, and this expects a refusal`);
  }
  return read.left;
};

const outsideRoot = (requested: string, resolved: string): WorkspaceFailure =>
  WorkspaceFailure.OutsideRoot({
    requested,
    resolved: realpathSync(resolved),
    root: workspace.root,
    host: HostDirectories.Pinned(),
  });

describe('the root a server is confined to', () => {
  it('resolves the root through its own symbolic links', () => {
    expect(workspace.root).toEqual(realpathSync(tree.root));
  });

  it('refuses a root that is not there, naming it', () => {
    const missing = join(tree.root, 'nowhere');
    const refused = openWorkspace({ root: missing });
    expect(
      Either.isLeft(refused)
        ? renderWorkspaceFailure(refused.left).join('\n')
        : 'the root was accepted',
    ).toContain(`The root "${missing}" cannot be used: ENOENT`);
  });

  it('takes a default file inside the root and resolves it', () => {
    expect(opened('small.yaml').defaultFile).toEqual(
      join(workspace.root, 'small.yaml'),
    );
  });

  it('refuses a default file outside the root', () => {
    expect(
      Either.isLeft(
        openWorkspace({ root: tree.root, file: '../outside.yaml' }),
      ),
    ).toBe(true);
  });

  it('holds the default file to the root where the server follows the host', () => {
    expect(
      Either.isLeft(
        openWorkspace({
          root: tree.root,
          file: '../outside.yaml',
          reach: 'host',
        }),
      ),
    ).toBe(true);
  });
});

describe('a path a tool call names', () => {
  it('reads a file under the root', () => {
    const read = readModelFile(workspace, 'small.yaml');
    expect(Either.isRight(read)).toBe(true);
  });

  it('refuses a path that climbs out of the root, with where it resolved', () => {
    expect(failureOf('../outside.yaml')).toEqual(
      outsideRoot('../outside.yaml', tree.outside),
    );
  });

  it('refuses a link inside the root that points outside it', () => {
    expect(failureOf('link.yaml')).toEqual(
      outsideRoot('link.yaml', tree.outside),
    );
  });

  it('refuses an absolute path outside the root', () => {
    expect(WorkspaceFailure.$is('OutsideRoot')(failureOf(tree.outside))).toBe(
      true,
    );
  });

  it('refuses a sibling directory whose name starts with the root', () => {
    expect(failureOf('../root-evil/secret.yaml')).toEqual(
      outsideRoot('../root-evil/secret.yaml', tree.sibling),
    );
  });

  it('reports a file that is not there as unreadable', () => {
    expect(WorkspaceFailure.$is('Unreadable')(failureOf('absent.yaml'))).toBe(
      true,
    );
  });

  it('refuses a named pipe rather than blocking on the read', () => {
    const pipe = namedPipeIn(workspace.root, 'wedge.yaml');
    try {
      expect(renderWorkspaceFailure(failureOf('wedge.yaml'))).toEqual([
        'The file "wedge.yaml" cannot be read: it is not a regular file.',
      ]);
    } finally {
      rmSync(pipe);
    }
  });

  it('refuses a directory the same way', () => {
    expect(renderWorkspaceFailure(failureOf('nested'))).toEqual([
      'The file "nested" cannot be read: it is not a regular file.',
    ]);
  });

  it('carries the codec wording for a text no format claimed', () => {
    const unclaimed = DetectionFailure.NoFormatClaimed({
      tried: ['threat-dragon', 'saerskriven-yaml'],
    });
    expect(failureOf('unclaimed.yaml')).toEqual(
      WorkspaceFailure.Unread({ path: 'unclaimed.yaml', failure: unclaimed }),
    );
    expect(renderWorkspaceFailure(failureOf('unclaimed.yaml'))).toEqual([
      'The file "unclaimed.yaml" was not read.',
      ...renderReadFailure(unclaimed),
    ]);
  });
});

describe('a path beyond the root, on a call the host listed a directory for', () => {
  const host = hostTree();
  const listing = HostDirectories.Listed({ directories: [host.listed] });
  const following: ModelWorkspace = {
    ...Either.getOrThrow(openWorkspace({ root: host.launch, reach: 'host' })),
    host: listing,
  };
  const listedModel = join(host.listed, modelFile);

  it('resolves an absolute path inside the listed directory', () => {
    expect(confined(following, listedModel)).toEqual(Either.right(listedModel));
  });

  it('resolves a relative path against the root, into the listed directory', () => {
    expect(confined(following, relative(host.launch, listedModel))).toEqual(
      Either.right(listedModel),
    );
  });

  it.each([
    [
      'a sibling whose name starts with the listed directory',
      join(host.sibling, modelFile),
      join(host.sibling, modelFile),
    ],
    [
      'a link in the listed directory that leaves every permitted one',
      join(host.listed, leakFile),
      join(host.unlisted, modelFile),
    ],
    [
      'a directory the host did not list',
      join(host.unlisted, modelFile),
      join(host.unlisted, modelFile),
    ],
  ])(
    'refuses %s, with where it resolved and the listing',
    (_what, requested, resolved) => {
      expect(confined(following, requested)).toEqual(
        Either.left(
          WorkspaceFailure.OutsideRoot({
            requested,
            resolved,
            root: host.launch,
            host: listing,
          }),
        ),
      );
    },
  );

  it('reads the listing of no call but its own', () => {
    const unasked = Either.getOrThrow(
      openWorkspace({ root: host.launch, reach: 'host' }),
    );
    expect(Either.isLeft(confined(unasked, listedModel))).toBe(true);
  });

  it('holds the default file to the root, whatever the call was listed', () => {
    const own = hostTree();
    const defaulted = Either.getOrThrow(
      openWorkspace({ root: own.launch, file: insideFile, reach: 'host' }),
    );
    rmSync(join(own.launch, insideFile));
    symlinkSync(join(own.listed, modelFile), join(own.launch, insideFile));
    const named = namedModel(
      {
        ...defaulted,
        host: HostDirectories.Listed({ directories: [own.listed] }),
      },
      undefined,
    );
    expect(
      named === undefined
        ? undefined
        : readModelFile(named.workspace, named.file),
    ).toEqual(
      Either.left(
        WorkspaceFailure.OutsideRoot({
          requested: join(own.launch, insideFile),
          resolved: join(own.listed, modelFile),
          root: own.launch,
          host: HostDirectories.Unasked(),
        }),
      ),
    );
  });

  it('names a file under the root by its relative path, and one beyond it by its absolute path', () => {
    expect(
      [
        join(host.launch, insideFile),
        listedModel,
        `${host.launch}-evil/${modelFile}`,
      ].map((path) => resultPath(following, path)),
    ).toEqual([insideFile, listedModel, `${host.launch}-evil/${modelFile}`]);
  });
});

const refusal = (host: HostDirectories): readonly string[] =>
  renderWorkspaceFailure(
    WorkspaceFailure.OutsideRoot({
      requested: '../spelled.yaml',
      resolved: '/resolved/spelled.yaml',
      root: '/launch',
      host,
    }),
  );

describe('the refusal of a path outside every permitted directory', () => {
  it('names the spelling, where it resolved and the root in two lines, for a call the host was not asked about', () => {
    const lines = refusal(HostDirectories.Unasked());
    expect(lines).toHaveLength(2);
    expect(
      ['"../spelled.yaml"', '"/resolved/spelled.yaml"', '"/launch"'].filter(
        (named) => !lines.join('\n').includes(named),
      ),
    ).toEqual([]);
  });

  it('names the spelling, where it resolved, the root and every directory the host listed', () => {
    const text = refusal(
      HostDirectories.Listed({ directories: ['/listed/one', '/listed/two'] }),
    ).join('\n');
    expect(
      [
        '"../spelled.yaml"',
        '"/resolved/spelled.yaml"',
        '"/launch"',
        '"/listed/one"',
        '"/listed/two"',
      ].filter((named) => !text.includes(named)),
    ).toEqual([]);
  });

  it('adds one line of its own for each reason the host added nothing', () => {
    const reasons = [
      HostDirectories.Pinned(),
      HostDirectories.Undeclared(),
      HostDirectories.Unanswered(),
      HostDirectories.Overlong({ entries: 65, limit: 64 }),
    ].map(refusal);
    expect(reasons.map((lines) => lines.slice(0, 2))).toEqual(
      reasons.map(() => refusal(HostDirectories.Unasked())),
    );
    expect(
      new Set(reasons.map((lines) => lines.slice(2).join('\n'))).size,
    ).toBe(reasons.length);
    expect(reasons.map((lines) => lines.length)).toEqual([3, 3, 3, 3]);
  });

  it('names how many entries the host listed and how many the server reads, where the list was too long', () => {
    const line =
      refusal(HostDirectories.Overlong({ entries: 65, limit: 64 }))[2] ?? '';
    expect([line.includes('65'), line.includes('64')]).toEqual([true, true]);
  });

  it('says so where the host listed nothing usable', () => {
    expect(refusal(HostDirectories.Listed({ directories: [] }))).toHaveLength(
      3,
    );
  });
});

describe('the reason a thrown value gives', () => {
  it('reports a thrown value that is not an Error as it prints', () => {
    expect(reasonOf('the disk went away')).toEqual('the disk went away');
  });
});
