import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { otmWireSchema } from '@saerskriven/wire-otm';
import { tmbomWireSchema } from '@saerskriven/wire-tmbom';

const vendored = join(import.meta.dirname, '../../../../test-data');

/**
 * Every OTM and TM-BOM document the repository vendors, named by its path
 * under `test-data` and read from the directories, so a document added
 * beside them is swept. The vendored JSON Schemas are not documents.
 */
export const importCorpus: readonly { name: string; text: string }[] = [
  'otm',
  'tmbom',
].flatMap((folder) =>
  readdirSync(join(vendored, folder))
    .filter((name) => name.endsWith('.json') && !name.startsWith('schema'))
    .map((name) => ({
      name: `${folder}/${name}`,
      text: readFileSync(join(vendored, folder, name), 'utf8'),
    })),
);

/** The upstream examples retain unknown fields to exercise import reports. */
export const importTexts = {
  otm: readFileSync(join(vendored, 'otm/example.json'), 'utf8'),
  tmbom: readFileSync(join(vendored, 'tmbom/example.json'), 'utf8'),
};

/** A fresh OTM example for tests that change source facts. */
export const otmFixture = () =>
  otmWireSchema.parse(JSON.parse(importTexts.otm) as unknown);
/** A fresh TM-BOM example for tests that change source facts. */
export const tmbomFixture = () =>
  tmbomWireSchema.parse(JSON.parse(importTexts.tmbom) as unknown);
