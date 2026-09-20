import { repositoryRoot } from '@saerskriven/model/fixtures';
import { themedCanvasStylesheet } from '@saerskriven/canvas';
import { tokenStylesheet } from '@saerskriven/canvas/tokens';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { initialPageStylesheet } from '../initial-page.mjs';

const studioTree = join(repositoryRoot, 'apps/studio/src');

const trees = [studioTree, join(repositoryRoot, 'packages/canvas/src')];

const tokenModule = join(repositoryRoot, 'packages/canvas/src/lib/tokens.ts');

const styled = /\.(css|tsx?)$/u;

const beside = /\.(spec|test)\./u;

const filesUnder = (from: string): string[] =>
  readdirSync(from, { withFileTypes: true }).flatMap((entry) => {
    const path = join(from, entry.name);
    return entry.isDirectory()
      ? filesUnder(path)
      : styled.test(entry.name) && !beside.test(entry.name)
        ? [path]
        : [];
  });

const sourceAt = (path: string): { path: string; text: string } => ({
  path: relative(repositoryRoot, path),
  text: readFileSync(path, 'utf8'),
});

const sources = trees
  .flatMap(filesUnder)
  .filter((path) => path !== tokenModule)
  .map(sourceAt);

const studioSources = filesUnder(studioTree).map(sourceAt);

const literalColour =
  /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/u;

const referenced = (text: string): string[] =>
  (text.match(/var\(\s*--[\w-]+/gu) ?? []).map((token) =>
    token.replace(/^var\(\s*/u, ''),
  );

const allReferenced = new Set([
  ...sources.flatMap((source) => referenced(source.text)),
  ...referenced(themedCanvasStylesheet),
  ...referenced(initialPageStylesheet),
]);

const readFromElsewhere = new Set([
  '--radix-dropdown-menu-content-available-height',
  '--radix-dropdown-menu-content-available-width',
  '--radix-select-content-available-height',
  '--radix-select-content-available-width',
]);

const readProperties = new Set(
  [...allReferenced].filter((property) => !readFromElsewhere.has(property)),
);

const socialCardSource = readFileSync(
  join(repositoryRoot, 'apps/studio/social-card-source.html'),
  'utf8',
);

const cardReferenced = new Set(referenced(socialCardSource));

const cardReadProperties = new Set(
  [...cardReferenced].filter((property) => !readFromElsewhere.has(property)),
);

describe('the studio and the canvas, coloured from one table', () => {
  it('carries no literal colour outside the token module', () => {
    const carrying = sources.filter((source) =>
      literalColour.test(source.text),
    );
    expect(carrying.map((source) => source.path)).toEqual([]);
  });

  it('walks the production files of both trees and no spec', () => {
    const walked = sources.map((source) => source.path);
    expect(walked).toContain('apps/studio/src/styles.css');
    expect(walked).toContain('packages/canvas/src/lib/stylesheet.ts');
    expect(walked.filter((path) => beside.test(path))).toEqual([]);
  });
});

describe('the studio browser interfaces', () => {
  it('uses no browser dialog global', () => {
    const browserDialogGlobal =
      /(?:(?:window|globalThis)\.)?\b(?:alert|confirm|prompt)\s*\(/u;
    const carrying = studioSources.filter((source) =>
      browserDialogGlobal.test(source.text),
    );

    expect(carrying.map((source) => source.path)).toEqual([]);
  });
});

const darkScheme = '@media (prefers-color-scheme: dark)';

const colourDeclarations = (block: string): Set<string> =>
  new Set(block.match(/--saer-colour-[\w-]+(?=:)/gu) ?? []);

const undeclared = (properties: Iterable<string>, sheet: string): string[] =>
  [...properties].filter((property) => !sheet.includes(`${property}:`));

describe('the document theme', () => {
  it('declares every custom property the studio reads, the injected canvas sheet among them, bar the ones read from elsewhere', () => {
    const missing = undeclared(readProperties, initialPageStylesheet);
    expect(missing).toEqual([]);
  });

  it('names no property on the elsewhere list that nothing reads', () => {
    const unused = [...readFromElsewhere].filter(
      (property) =>
        !allReferenced.has(property) && !cardReferenced.has(property),
    );
    expect(unused).toEqual([]);
  });

  it('declares them on the document root, so any module reads them', () => {
    expect(initialPageStylesheet.startsWith(':root {')).toBe(true);
  });

  it('overrides them under the system dark preference, which is the whole of the mode switch', () => {
    expect(initialPageStylesheet).toContain(darkScheme);

    const [root, dark] = initialPageStylesheet.split(darkScheme);
    expect(colourDeclarations(dark)).toEqual(colourDeclarations(root));
  });
});

describe('the social card', () => {
  it('declares every custom property its source reads, against the token sheet its build embeds, bar the ones read from elsewhere', () => {
    const missing = undeclared(cardReadProperties, tokenStylesheet);
    expect(missing).toEqual([]);
  });
});
