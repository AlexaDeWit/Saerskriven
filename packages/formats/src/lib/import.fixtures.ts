import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { otmWireSchema } from '@saerskriven/wire-otm';
import { tmbomWireSchema } from '@saerskriven/wire-tmbom';
import { testData, vendoredTexts } from './corpus.fixtures.js';

/**
 * Every OTM and TM-BOM document the repository vendors, named by its path
 * under `test-data`. The vendored JSON Schemas are not documents.
 */
export const importCorpus: readonly { name: string; text: string }[] =
  vendoredTexts(
    ['otm', 'tmbom'],
    (name) => name.endsWith('.json') && !name.startsWith('schema'),
  );

/** The upstream examples retain unknown fields to exercise import reports. */
export const importTexts = {
  otm: readFileSync(join(testData, 'otm/example.json'), 'utf8'),
  tmbom: readFileSync(join(testData, 'tmbom/example.json'), 'utf8'),
};

/** A fresh OTM example for tests that change source facts. */
export const otmFixture = () =>
  otmWireSchema.parse(JSON.parse(importTexts.otm) as unknown);
/** A fresh TM-BOM example for tests that change source facts. */
export const tmbomFixture = () =>
  tmbomWireSchema.parse(JSON.parse(importTexts.tmbom) as unknown);
