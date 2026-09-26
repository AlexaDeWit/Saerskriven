import { readLimits } from '@saerskriven/formats';
import { Either } from 'effect';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ansiElementIdYaml,
  fixtureFile,
  literalEscapeIdYaml,
  scratchDirectory,
} from './cli.fixtures.js';
import * as files from './files.js';
import { describeDivergences, readModel } from './input.js';

const directory = scratchDirectory('input');

const refusedModel = (err: string) => Either.left({ code: 1, out: '', err });

describe('a model file read at the edge', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses a file past the size bound without reading it', () => {
    const path = join(directory, 'huge.yaml');
    const size = readLimits.maxTextBytes + 1;
    writeFileSync(path, 'x'.repeat(size));
    const read = vi.spyOn(files, 'readTextFile');
    expect(readModel(path)).toEqual(
      refusedModel(
        'The file is past a read bound, so nothing read it.\n' +
          `maxTextBytes: the bound is ${String(readLimits.maxTextBytes)}, the file reached ${String(size)}.\n`,
      ),
    );
    expect(read).not.toHaveBeenCalled();
  });

  it('escapes the control characters a model file put in an issue', () => {
    const path = fixtureFile(directory, 'ansi-id.yaml', ansiElementIdYaml);
    expect(readModel(path)).toEqual(
      refusedModel(
        'The file is a valid document, and the model it maps to is not:\n' +
          'threats.0.elements.0: text carries a character the model does not accept\n' +
          'threats.0.elements.0: names unknown element id "\\u001b[31mBOOM\\u001b[0m"\n',
      ),
    );
  });

  it('tells a text spelling an escape apart from one carrying it', () => {
    const path = fixtureFile(directory, 'literal.yaml', literalEscapeIdYaml);
    expect(readModel(path)).toEqual(
      refusedModel(
        'The file is a valid document, and the model it maps to is not:\n' +
          'threats.0.elements.0: names unknown element id "\\\\e[31mBOOM\\\\e[0m"\n',
      ),
    );
  });
});

describe('what a read cost', () => {
  it('says nothing where the file and the model correspond', () => {
    expect(describeDivergences([])).toEqual('');
  });
});
