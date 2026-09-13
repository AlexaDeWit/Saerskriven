import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The repository's `test-data` directory. */
export const testData = join(import.meta.dirname, '../../../../test-data');

/**
 * Every file `include` keeps in each of `folders` under `test-data`, named
 * by its path under `test-data`. The folders are read rather than listed, so
 * a file added beside the others is read without anything else changing.
 */
export function vendoredTexts(
  folders: readonly string[],
  include: (name: string) => boolean,
): { name: string; text: string }[] {
  return folders.flatMap((folder) =>
    readdirSync(join(testData, folder))
      .filter(include)
      .map((name) => ({
        name: `${folder}/${name}`,
        text: readFileSync(join(testData, folder, name), 'utf8'),
      })),
  );
}
