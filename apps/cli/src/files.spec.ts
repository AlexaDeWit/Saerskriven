import { Either } from 'effect';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { scratchDirectory } from './cli.fixtures.js';
import { readTextFile, writeFile } from './files.js';

const directory = scratchDirectory('files');

describe('text files at the edge', () => {
  it('writes a text and reads back what it wrote', () => {
    const path = join(directory, 'written.txt');
    expect(writeFile(path, 'Særskriven\n')).toEqual(Either.right(undefined));
    expect(readTextFile(path)).toEqual(Either.right('Særskriven\n'));
  });

  it('names the path and the reason where a file is not there', () => {
    const path = join(directory, 'absent.txt');
    expect(readTextFile(path)).toEqual(
      Either.left(
        `cannot read ${path}: ENOENT: no such file or directory, open '${path}'`,
      ),
    );
  });

  it('names the path and the reason where a file cannot be written', () => {
    const path = join(directory, 'absent', 'written.txt');
    expect(writeFile(path, '')).toEqual(
      Either.left(
        `cannot write ${path}: ENOENT: no such file or directory, open '${path}'`,
      ),
    );
    expect(existsSync(path)).toBe(false);
  });
});
