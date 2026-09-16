import { Either } from 'effect';
import { join } from 'node:path';
import { candidateFiles } from './candidates.js';
import { workspaceTree } from './workspace.fixtures.js';
import { openWorkspace } from './workspace.js';

const workspace = Either.getOrThrow(
  openWorkspace({ root: workspaceTree().root }),
);

describe('the candidate files under a root', () => {
  it('lists model extensions from the root and below, and no link', () => {
    expect(candidateFiles(workspace)).toEqual({
      files: [join('nested', 'deeper.yaml'), 'small.yaml', 'unclaimed.yaml'],
      truncated: false,
    });
  });
});
