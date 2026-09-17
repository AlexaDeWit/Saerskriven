import { unclaimedYaml } from '@saerskriven/mcp/fixtures';
import { testDataPath } from '@saerskriven/model/fixtures';
import {
  brokenDocumentYaml,
  danglingReferenceYaml,
  elementLinkedAssumptionYaml,
  fixtureFile,
  scratchDirectory,
  undeclaredKeyYaml,
} from './cli.fixtures.js';
import { validate } from './validate.js';

const directory = scratchDirectory('validate');

const validated = (name: string, text: string) =>
  validate(fixtureFile(directory, name, text));

describe('validate', () => {
  it('reads a Threat Dragon file and counts what the model holds', () => {
    expect(
      validate(testDataPath('threat-dragon/feature-complete.json')),
    ).toEqual({
      code: 0,
      out: 'threat-dragon: 2 diagrams, 13 elements, 24 threats\n',
      err:
        'warning: the file and the model do not correspond exactly.\n' +
        'threat "threat-card": the Elevation of Privilege card, of which the model holds the suit alone (reduced to fit the format)\n',
    });
  });

  it('reads a native file of two diagrams and counts what the model holds', () => {
    expect(validate(testDataPath('saerskriven/feature-complete.yaml'))).toEqual(
      {
        code: 0,
        out: 'saerskriven-yaml: 2 diagrams, 12 elements, 31 threats\n',
        err: '',
      },
    );
  });

  it('warns about what a read dropped, and still succeeds', () => {
    expect(validated('undeclared.yaml', undeclaredKeyYaml)).toEqual({
      code: 0,
      out: 'saerskriven-yaml: 0 diagrams, 0 elements, 1 threat\n',
      err:
        'warning: the file and the model do not correspond exactly.\n' +
        'model: the key nonsense (not declared by the wire schema)\n',
    });
  });

  it('warns naming an assumption whose element links a read dropped, and still succeeds', () => {
    const result = validated('linked.yaml', elementLinkedAssumptionYaml);
    expect(result).toMatchObject({
      code: 0,
      out: 'saerskriven-yaml: 1 diagram, 1 element, 1 threat\n',
    });
    expect(result.err).toContain('\nassumption "assumption-1": ');
  });

  it('refuses a document the wire schema does not describe', () => {
    expect(validated('broken.yaml', brokenDocumentYaml)).toEqual({
      code: 1,
      out: '',
      err:
        'The file is not a valid document of the format that claimed it:\n' +
        'metadata.title: Invalid input: expected string, received number\n',
    });
  });

  it('points into the model where a reference resolves to nothing', () => {
    expect(validated('dangling.yaml', danglingReferenceYaml)).toEqual({
      code: 1,
      out: '',
      err:
        'The file is a valid document, and the model it maps to is not:\n' +
        'threats.0.elements.0: Threat elements references unknown element id "element-2".\n',
    });
  });

  it('names the bound a text was past', () => {
    expect(validate(testDataPath('adversarial/deep-nesting.json'))).toEqual({
      code: 1,
      out: '',
      err:
        'The file is past a read bound, so nothing read it.\n' +
        'maxNestingDepth: the bound is 64, the file reached 65.\n',
    });
  });

  it('lists the formats tried where none claimed the text', () => {
    expect(validated('unclaimed.yaml', unclaimedYaml)).toMatchObject({
      code: 1,
      out: '',
    });
  });

  it('reports a file it cannot read as the invocation being wrong', () => {
    const path = testDataPath('absent.json');
    const outcome = validate(path);
    expect(outcome).toMatchObject({ code: 2, out: '' });
    expect(outcome.err.startsWith(`error: cannot read ${path}: `)).toBe(true);
  });
});
