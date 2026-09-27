import { ReadFailure } from './codec.js';
import { DetectionFailure } from './detect.js';
import { renderReadFailure } from './read-failure.js';

describe('why a read produced nothing', () => {
  it('names the bound a text was past', () => {
    expect(
      renderReadFailure(
        ReadFailure.ExceededReadLimit({
          limit: 'maxNestingDepth',
          bound: 64,
          observed: 65,
        }),
      ),
    ).toEqual([
      'The file is past a read bound, so nothing read it.',
      'maxNestingDepth: the bound is 64, the file reached 65.',
    ]);
  });

  it("carries the parser's own message for a text of no syntax", () => {
    expect(
      renderReadFailure(ReadFailure.MalformedText({ message: 'bad token' })),
    ).toEqual([
      'The file is not valid text of the format that claimed it.',
      'bad token',
    ]);
  });

  it('points into the document the wire schema refused', () => {
    expect(
      renderReadFailure(
        ReadFailure.InvalidWireDocument({
          issues: [
            {
              path: ['metadata', 'title'],
              detail: {
                code: 'type-mismatch',
                parameters: { expected: 'string', received: 'number' },
              },
            },
          ],
        }),
      ),
    ).toEqual([
      'The file is not a valid document of the format that claimed it:',
      'metadata.title: expected a string, received a number',
    ]);
  });

  it('names the whole document where an issue points at no path', () => {
    expect(
      renderReadFailure(
        ReadFailure.InvalidModel({
          issues: [
            {
              path: [],
              detail: {
                code: 'type-mismatch',
                parameters: { expected: 'object', received: 'string' },
              },
            },
          ],
        }),
      ),
    ).toEqual([
      'The file is a valid document, and the model it maps to is not:',
      '(root): expected an object, received a string',
    ]);
  });

  it('escapes an escape the refused document carried into a message', () => {
    expect(
      renderReadFailure(
        ReadFailure.InvalidModel({
          issues: [
            {
              path: ['threats', 0],
              detail: {
                code: 'unknown-element-reference',
                parameters: { id: 'saw \u001b[31m' },
              },
            },
          ],
        }),
      ),
    ).toEqual([
      'The file is a valid document, and the model it maps to is not:',
      'threats.0: names unknown element id "saw \\u001b[31m"',
    ]);
  });

  it("words an import's own code beside the parse issue codes", () => {
    expect(
      renderReadFailure(
        ReadFailure.InvalidWireDocument({
          issues: [
            {
              path: [],
              detail: {
                code: 'import-format-unnamed',
                parameters: { otm: ['0.2.0'], tmbom: ['1.0.1', '1.0.2'] },
              },
            },
            {
              path: ['components', 0, 'parent'],
              detail: { code: 'otm-parent-not-single' },
            },
          ],
        }),
      ),
    ).toEqual([
      'The file is not a valid document of the format that claimed it:',
      '(root): import requires an OTM 0.2.0 version stamp or a TM-BOM 1.0.1 or 1.0.2 schema URI',
      'components.0.parent: a parent names exactly one trust zone or component',
    ]);
  });

  it('carries the reason a wire parse threw', () => {
    expect(
      renderReadFailure(
        ReadFailure.InvalidWireDocument({
          issues: [
            {
              path: [],
              detail: {
                code: 'schema-threw',
                parameters: { reason: 'TypeError: the schema gave out' },
              },
            },
          ],
        }),
      ),
    ).toContain('(root): the parse stopped: TypeError: the schema gave out');
  });

  it('serializes a failure to its plain tagged shape', () => {
    const failure = ReadFailure.InvalidWireDocument({ issues: [] });
    expect(JSON.parse(JSON.stringify(failure)) as unknown).toEqual({
      _tag: 'InvalidWireDocument',
      issues: [],
    });
  });

  it('lists the formats tried where none claimed the text', () => {
    expect(
      renderReadFailure(
        DetectionFailure.NoFormatClaimed({
          tried: ['threat-dragon', 'saerskriven-yaml'],
        }),
      ),
    ).toEqual([
      'No format claimed the file. Saerskriven tried threat-dragon, saerskriven-yaml.',
    ]);
  });
});
