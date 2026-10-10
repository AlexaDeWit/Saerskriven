import { existsSync, readFileSync } from 'node:fs';
import { bundlePath, compiledRunner } from './runners.fixtures.js';

const networkModules = ['http', 'https', 'http2', 'net', 'tls', 'dgram', 'dns'];

const nodeModulesImportedBy = (bundle: string): ReadonlySet<string> =>
  new Set(
    [
      ...bundle.matchAll(
        /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\(\s*)["'](?:node:)?([a-z_\d]+)(?:\/[a-z_\d/]+)?["']/g,
      ),
    ].map((match) => match[1] ?? ''),
  );

describe('the CLI as it is packaged', () => {
  it('has a bundle to run, which the build target produced', () => {
    expect(existsSync(bundlePath)).toBe(true);
  });

  it('has a bundle that imports node:fs and none of the modules node reaches a network with', () => {
    const imported = nodeModulesImportedBy(readFileSync(bundlePath, 'utf8'));
    expect({
      files: imported.has('fs'),
      network: networkModules.filter((name) => imported.has(name)),
    }).toEqual({ files: true, network: [] });
  });

  it('has the compiled executable wherever the environment demands one', () => {
    expect(
      process.env.SAERSKRIVEN_COMPILED_RUNNER === 'required'
        ? compiledRunner.absence
        : undefined,
    ).toBeUndefined();
  });
});
