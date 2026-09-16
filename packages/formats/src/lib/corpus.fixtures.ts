import { committedText, testDataPath } from '@saerskriven/model/fixtures';
import { readdirSync } from 'node:fs';

/** The text of a hostile input under `test-data/adversarial`. */
export const adversarialText = (name: string): string =>
  committedText('adversarial', name);

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
    readdirSync(testDataPath(folder))
      .filter(include)
      .map((name) => ({
        name: `${folder}/${name}`,
        text: committedText(folder, name),
      })),
  );
}
