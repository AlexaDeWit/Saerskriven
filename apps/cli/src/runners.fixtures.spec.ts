import { existsSync, readFileSync } from 'node:fs';
import {
  bundlePath,
  compiledRunner,
  modulesNamedIn,
} from './runners.fixtures.js';

const networkModules = [
  'http',
  'https',
  'http2',
  'net',
  'tls',
  'dgram',
  'dns',
  'inspector',
];

const references: readonly (readonly [
  string,
  string,
  'imported' | 'required',
  string,
])[] = [
  [
    'the require esbuild leaves of a CommonJS dependency',
    'var http = __require("http");',
    'required',
    'http',
  ],
  [
    'that require read as an ES module',
    'var import_tls = __toESM(__require("node:tls"));',
    'required',
    'tls',
  ],
  ['a static import', 'import { connect } from "node:net";', 'imported', 'net'],
  ['a side-effect import', 'import "node:dns";', 'imported', 'dns'],
  ['a re-export', 'export * from "node:dgram";', 'imported', 'dgram'],
  [
    'a dynamic import',
    'var lazy = () => import("node:inspector");',
    'imported',
    'inspector',
  ],
  [
    'a subpath as the module it belongs to',
    'import { pipeline } from "node:stream/promises";',
    'imported',
    'stream',
  ],
];

describe('the modules a bundle names', () => {
  it.each(references)('reads %s', (_form, text, family, name) => {
    expect(modulesNamedIn(text)).toEqual({
      imported: new Set(),
      required: new Set(),
      [family]: new Set([name]),
    });
  });
});

describe('the CLI as it is packaged', () => {
  it('has a bundle to run, which the build target produced', () => {
    expect(existsSync(bundlePath)).toBe(true);
  });

  it('has a bundle that names no module node reaches a network with, by import or by require', () => {
    const named = modulesNamedIn(readFileSync(bundlePath, 'utf8'));
    expect({
      importsFiles: named.imported.has('fs'),
      requiresBuffer: named.required.has('buffer'),
      network: networkModules.filter(
        (name) => named.imported.has(name) || named.required.has(name),
      ),
    }).toEqual({ importsFiles: true, requiresBuffer: true, network: [] });
  });

  it('has the compiled executable wherever the environment demands one', () => {
    expect(
      process.env.SAERSKRIVEN_COMPILED_RUNNER === 'required'
        ? compiledRunner.absence
        : undefined,
    ).toBeUndefined();
  });
});
