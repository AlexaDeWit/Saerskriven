import { otmWireSchema } from '@saerskriven/wire-otm';
import { tmbomWireSchema } from '@saerskriven/wire-tmbom';
import { testDataText, vendoredTexts } from './corpus.fixtures.js';

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
  otm: testDataText('otm/example.json'),
  tmbom: testDataText('tmbom/example.json'),
};

/** A fresh OTM example for tests that change source facts. */
export const otmFixture = () =>
  otmWireSchema.parse(JSON.parse(importTexts.otm) as unknown);
/** A fresh TM-BOM example for tests that change source facts. */
export const tmbomFixture = () =>
  tmbomWireSchema.parse(JSON.parse(importTexts.tmbom) as unknown);
