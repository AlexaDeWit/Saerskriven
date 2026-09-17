import { committedText, testDataPath } from '@saerskriven/model/fixtures';
import { readdirSync } from 'node:fs';
import { z } from 'zod';

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

/**
 * How long the spec that reads the whole corpus twice is given, past the
 * root `vitest.shared.mts` sets. It puts every file in `corpusTexts` through
 * both the Threat Dragon read and the Saerskriven YAML read, so its cost grows
 * with the corpus rather than staying fixed, and ten runs of the whole
 * workspace's suites on a contended host measured it at 9.8 seconds.
 */
export const corpusTimeout = 30_000;

/**
 * Every Threat Dragon threat model the repository vendors, named by its
 * path under `test-data`: the twelve models Threat Dragon ships in its own
 * repository, described in `test-data/README.md`. The vendored locale tables
 * live under the same root and are not threat models, so they are not read
 * here.
 */
export const corpusTexts: readonly { name: string; text: string }[] =
  vendoredTexts(['threat-dragon/demo', 'threat-dragon/models'], (name) =>
    name.endsWith('.json'),
  );

/**
 * The JSON Schema Threat Dragon validates a v2 model against before it
 * opens one, vendored under `test-data/threat-dragon/schema`. A write is
 * measured against it with the validator Threat Dragon itself runs, which
 * gates the shape of the document alone: the schema declares a cell's
 * threats beside `data` rather than under it, so nothing it says reaches
 * the threats this codec writes.
 */
export const threatDragonJsonSchema: Readonly<Record<string, unknown>> = z
  .record(z.string(), z.unknown())
  .parse(
    JSON.parse(
      committedText('threat-dragon/schema/threat-dragon-v2.schema.json'),
    ),
  );

/**
 * Threat Dragon's category labels in every language it ships, keyed by
 * language and then by methodology, as vendored under
 * `test-data/threat-dragon/i18n`. The tables in `threat-dragon-locales.ts`
 * are derived from exactly this, so the derivation is what a test checks
 * rather than the result.
 */
export const localeCategories: Readonly<
  Record<string, Readonly<Record<string, Readonly<Record<string, string>>>>>
> = Object.fromEntries(
  readdirSync(testDataPath('threat-dragon/i18n'))
    .filter((name) => name.endsWith('.json'))
    .map((name) => [name.replace(/\.json$/, ''), categoriesIn(name)]),
);

function categoriesIn(name: string): Record<string, Record<string, string>> {
  const parsed: unknown = JSON.parse(committedText('threat-dragon/i18n', name));
  return z.record(z.string(), z.record(z.string(), z.string())).parse(parsed);
}
