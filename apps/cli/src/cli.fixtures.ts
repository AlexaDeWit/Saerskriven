import { referencingYaml, smallYaml } from '@saerskriven/mcp/fixtures';
import { testDataPath } from '@saerskriven/model/fixtures';
import { typstFontFiles } from '@saerskriven/render/build-assets';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { resvgWasmFile } from './png.js';

/**
 * A native file whose one threat names an element no diagram holds. The
 * document is valid and the model it maps to is not, which is the failure
 * that carries a path into the model rather than into the file.
 */
export const danglingReferenceYaml = referencingYaml('element-2');

/**
 * A native file whose one threat names an element id built out of ANSI
 * escapes, which the model refuses and then quotes back in the sentence
 * saying the reference resolves to nothing.
 */
export const ansiElementIdYaml = referencingYaml('"\\e[31mBOOM\\e[0m"');

/**
 * A native file whose one threat names an element id spelling those same
 * escapes out of literal characters. The model accepts the text, and what
 * a user reads has to tell it apart from the file above.
 */
export const literalEscapeIdYaml = referencingYaml('"\\\\e[31mBOOM\\\\e[0m"');

/**
 * A native file carrying a key the wire schema does not declare, which a
 * read drops and reports as a divergence rather than passing over.
 */
export const undeclaredKeyYaml = smallYaml.replace(
  'diagrams: []',
  'nonsense: true\ndiagrams: []',
);

/**
 * A version 1 native file whose one assumption links the file's element as
 * well as its threat, which a read drops and reports.
 */
export const elementLinkedAssumptionYaml = referencingYaml('element-1').replace(
  'assumptions: []',
  `assumptions:
  - id: assumption-1
    prose: The gateway authenticates every caller.
    status: valid
    elements: [element-1]
    threats: [threat-1]`,
);

/** A native file whose title is a number, which the wire schema refuses. */
export const brokenDocumentYaml = smallYaml.replace(
  'title: Small',
  'title: 42',
);

/**
 * A native file whose one threat carries the given text as its description,
 * so a spec that decides the shape of that prose has a model to put it in.
 */
export function proseThreatYaml(description: string): string {
  return smallYaml
    .replace('title: Spoofed caller', 'title: Deep prose')
    .replace(
      "    description: ''\n    mitigation:",
      () => `    description: ${JSON.stringify(description)}\n    mitigation:`,
    );
}

/**
 * One fixture on disk, at the path it was written to. A name holding a
 * directory of its own has it made first, which is what a host
 * configuration file nested under the project needs.
 */
export function fixtureFile(
  directory: string,
  name: string,
  text: string,
): string {
  const path = join(directory, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  return path;
}

const scratch: string[] = [];

afterAll(() => {
  for (const directory of scratch.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

/**
 * A fresh temporary directory, removed after the spec file that asked for
 * it. The removal hook is registered when a spec file imports this module.
 */
export function scratchDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), `saerskriven-cli-${prefix}-`));
  scratch.push(directory);
  return directory;
}

/** A committed render golden under `test-data/render`, as bytes. */
export const renderGolden = (name: string): Buffer =>
  readFileSync(testDataPath('render', name));

/**
 * An asset directory a rasterizer reads without drawing: a stand-in module
 * and one stand-in face per name, each face's bytes spelling `face:<name>`.
 */
export function fakeAssets(
  directory: string,
  faces: readonly string[] = typstFontFiles,
): string {
  writeFileSync(join(directory, resvgWasmFile), 'module');
  for (const name of faces) {
    writeFileSync(join(directory, name), `face:${name}`);
  }
  return directory;
}
