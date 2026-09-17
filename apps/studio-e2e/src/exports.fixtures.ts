import { committedText, testDataPath } from '@saerskriven/model/fixtures';
import { readFileSync } from 'node:fs';

/** A committed render output as bytes. */
export const exportGolden = (name: string): Buffer =>
  readFileSync(testDataPath('render', name));

/** The digest shared by the CLI and browser PDF checks, read at the call. */
export const expectedPdfDigest = (): string =>
  committedText('render', 'two-diagrams.snapshot.pdf.sha256').trim();

const pageTree = /\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/u;

/** The page count named by a PDF page tree. */
export const pdfPageCount = (pdf: Uint8Array): number => {
  const counted = pageTree.exec(Buffer.from(pdf).toString('latin1'));
  return counted === null ? 0 : Number(counted[1]);
};
