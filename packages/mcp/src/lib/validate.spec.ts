import { unclaimedFile } from '../fixtures.js';
import {
  answerOf,
  featureCompleteFile,
  featureCompleteWorkspace,
  invalidFile,
  refusalOf,
  rootWorkspace,
  unreadableTree,
} from './read-tools.fixtures.js';
import { validate } from './validate.js';

const workspace = featureCompleteWorkspace();

const unreadable = unreadableTree();

describe('what saer_validate reports', () => {
  it('reads a Threat Dragon file as the format its content names, and says the read diverged', () => {
    const checked = answerOf(validate(workspace, {}));
    expect({
      file: checked.file,
      format: checked.format,
      diverged: checked.diverged,
    }).toEqual({
      file: featureCompleteFile,
      format: 'threat-dragon',
      diverged: true,
    });
  });

  it('carries the revision handle a write has to quote back', () => {
    expect(answerOf(validate(workspace, {})).revision).toMatch(
      /^sha256:[0-9a-f]{64}$/u,
    );
  });

  it('names every format tried where no codec claims the file', () => {
    const refused = refusalOf(
      validate(unreadable, { file: unclaimedFile }),
    ).join('\n');
    expect(refused).toContain('threat-dragon');
    expect(refused).toContain('saerskriven-yaml');
  });

  it('refuses a claimed file with the path of the issue inside it', () => {
    const refused = refusalOf(validate(unreadable, { file: invalidFile }));
    expect(refused.join('\n')).toContain('threats.0.severity');
  });

  it('refuses a call naming no file where the server carries no default', () => {
    const unnamed = rootWorkspace();
    const refused = refusalOf(validate(unnamed, {}));
    expect(refused).toHaveLength(2);
    expect(refused[0]).toContain(unnamed.root);
    expect(refused[1]).toContain('saer_inspect');
  });
});
