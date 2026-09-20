import { repositoryRoot } from '@saerskriven/model/fixtures';
import { themedCanvasStylesheet } from '@saerskriven/canvas';
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

const sources = trees
  .flatMap(filesUnder)
  .filter((path) => path !== tokenModule)
  .map((path) => ({
    path: relative(repositoryRoot, path),
    text: readFileSync(path, 'utf8'),
  }));

const studioSources = filesUnder(studioTree).map((path) => ({
  path: relative(repositoryRoot, path),
  text: readFileSync(path, 'utf8'),
}));

const literalColour =
  /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/u;

const referenced = (text: string): string[] =>
  (text.match(/var\(--[\w-]+/gu) ?? []).map((token) => token.slice(4));

const readFromElsewhere = new Set([
  '--radix-dropdown-menu-content-available-height',
  '--radix-dropdown-menu-content-available-width',
  '--radix-select-content-available-height',
  '--radix-select-content-available-width',
]);

const readProperties = new Set(
  [
    ...sources.flatMap((source) => referenced(source.text)),
    ...referenced(themedCanvasStylesheet),
  ].filter((property) => !readFromElsewhere.has(property)),
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

describe('the document theme', () => {
  it('declares every custom property the studio reads, apart from the ones named as read from elsewhere, the injected canvas sheet among them', () => {
    const declared = initialPageStylesheet;
    const missing = [...readProperties].filter(
      (property) => !declared.includes(`${property}:`),
    );
    expect(missing).toEqual([]);
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
