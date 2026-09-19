import { Either } from 'effect';
import { inspect, renderInspection } from './inspect.js';
import {
  assumptionScopesTree,
  forgedIdsTree,
  forgedLinesIn,
} from './read-tools.fixtures.js';
import { workspaceTree } from './workspace.fixtures.js';
import { openWorkspace } from './workspace.js';

const tree = workspaceTree();

const workspace = Either.getOrThrow(openWorkspace({ root: tree.root }));

const rendered = (file?: string): readonly string[] =>
  Either.match(inspect(workspace, { file }), {
    onLeft: (refusal) => refusal,
    onRight: renderInspection,
  });

describe('what an inspection reads as', () => {
  it('states the file, the format, the handle and the counts', () => {
    expect(rendered('small.yaml')).toEqual([
      'file: small.yaml',
      'format: saerskriven-yaml',
      expect.stringMatching(/^revision: sha256:[0-9a-f]{64}$/u),
      'title: Small',
      'owner: Owner',
      'assumptions that apply to the model:',
      'totals: diagrams 0, elements 0, threats 1, mitigations 0, assumptions 0',
      'diagrams:',
      'divergences:',
      'No divergence recorded.',
    ]);
  });

  it('offers the candidates where no file was named and none is default', () => {
    expect(rendered()[0]).toEqual(
      'No file was named and this server carries no default, so these are the model files under the root:',
    );
  });

  it('reads the default file where a call names none', () => {
    const withDefault = Either.getOrThrow(
      openWorkspace({ root: tree.root, file: 'small.yaml' }),
    );
    expect(
      Either.map(
        inspect(withDefault, {}),
        (inspection) => inspection.result.kind,
      ),
    ).toEqual(Either.right('inspected'));
  });
});

describe('the assumptions an inspection lists', () => {
  const scoped = Either.getOrThrow(inspect(assumptionScopesTree(), {}));

  it('lists every assumption that applies to the model, and none that does not', () => {
    expect(
      scoped.result.kind === 'inspected'
        ? scoped.result.assumptions.map(({ id, threats }) => ({ id, threats }))
        : [],
    ).toEqual([
      { id: 'assumption-reviewed', threats: ['threat-tamper-order'] },
      { id: 'assumption-hand-written', threats: [] },
    ]);
  });

  it('names them in its text after the metadata', () => {
    const lines = renderInspection(scoped);
    const heading = lines.indexOf('assumptions that apply to the model:');
    expect(lines.indexOf('owner: Alexandra de Wit')).toBeLessThan(heading);
    expect(lines.slice(heading + 1, heading + 3)).toEqual([
      expect.stringMatching(/^ {2}"assumption-reviewed" \(valid\): /u),
      expect.stringMatching(/^ {2}"assumption-hand-written" \(valid\): /u),
    ]);
  });
});

describe('an inspection of a diagram whose id carries a line feed', () => {
  it('forges no line in its text', () => {
    const inspection = Either.getOrThrow(inspect(forgedIdsTree(), {}));
    expect(forgedLinesIn(renderInspection(inspection))).toEqual([]);
  });
});
