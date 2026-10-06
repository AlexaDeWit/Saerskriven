import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createContext, Script } from 'node:vm';
import { typstCspCallbacks } from '../typst-csp.mjs';

const directory = mkdtempSync(join(tmpdir(), 'saerskriven-typst-csp-'));
const packageDirectory = join(
  directory,
  '@myriaddreamin/typst-ts-web-compiler',
);
const manifestPath = join(packageDirectory, 'package.json');
const gluePath = join(packageDirectory, 'pkg/typst_ts_web_compiler.mjs');
mkdirSync(join(packageDirectory, 'pkg'), { recursive: true });

const source = `
const getStringFromWasm0 = (value) => value;
globalThis.withoutParameters = function(arg0, arg1) {
  return new Function(getStringFromWasm0(arg0, arg1));
};
globalThis.withParameters = function(arg0, arg1, arg2, arg3) {
  return new Function(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3));
};
`;

const transformed = (code = source, id = gluePath): string | null => {
  const hook = typstCspCallbacks().transform;
  if (typeof hook !== 'function') {
    throw new Error('The Typst adapter must expose a transform hook.');
  }
  const output: unknown = Reflect.apply(
    hook,
    {
      error(sentence: string) {
        throw new Error(sentence);
      },
    },
    [code, id],
  );
  if (output === null) {
    return null;
  }
  if (
    typeof output === 'object' &&
    output !== null &&
    'code' in output &&
    typeof output.code === 'string'
  ) {
    return output.code;
  }
  throw new Error('The Typst adapter returned no transformed source.');
};

const callback = (parameters: string, body: string) => {
  const code = transformed();
  if (code === null) {
    throw new Error('The Typst adapter did not transform its own glue.');
  }
  const context = createContext(
    {},
    { codeGeneration: { strings: false, wasm: false } },
  );
  new Script(code).runInContext(context);
  const constructor: unknown = Reflect.get(
    context,
    parameters === '' ? 'withoutParameters' : 'withParameters',
  );
  if (typeof constructor !== 'function') {
    throw new Error('The transformed glue has no callback constructor.');
  }
  const args = parameters === '' ? [body, 0] : [parameters, 0, body, 0];
  const generated: unknown = Reflect.apply(constructor, undefined, args);
  if (typeof generated !== 'function') {
    throw new Error('The transformed constructor returned no callback.');
  }
  return (...values: unknown[]): unknown =>
    Reflect.apply(generated, undefined, values);
};

beforeEach(() => {
  writeFileSync(manifestPath, JSON.stringify({ version: '0.7.0' }));
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe('the pinned Typst dummy callbacks under a policy that refuses JavaScript evaluation', () => {
  it('keeps modification time, file classification and path identity', () => {
    expect(callback('', 'return 0')()).toBe(0);
    expect(callback('', 'return true')()).toBe(true);
    expect(callback('path', 'return path')('/main.typ')).toBe('/main.typ');
  });

  it.each([
    ['AccessModel', 'withAccessModel'],
    ['Registry', 'withPackageRegistry'],
  ])('keeps the %s refusal', (subject, initialise) => {
    const message = `Dummy ${subject}, please initialize compiler with ${initialise}()`;
    const refuse = callback('', `throw new Error('${message}')`);
    expect(refuse).toThrowError(new Error(message));
  });

  it.each([
    ['', 'return globalThis'],
    ['other', 'return path'],
    ['path', 'return 0'],
  ])(
    'refuses unknown callback parameters %j or body %j',
    (parameters, body) => {
      expect(() => callback(parameters, body)).toThrowError(
        /Unsupported Typst dummy callback/u,
      );
    },
  );

  it.each([{ version: '0.7.1' }, { version: null }, {}, null])(
    'refuses an unreviewed compiler manifest %j',
    (manifest) => {
      writeFileSync(manifestPath, JSON.stringify(manifest));
      expect(() => transformed()).toThrowError(
        'Review the Typst CSP callbacks before changing the compiler version.',
      );
    },
  );

  it.each([
    source.replace(
      'new Function(getStringFromWasm0(arg0, arg1))',
      'changedConstructor()',
    ),
    source + source,
    source + '\nnew Function("return globalThis");',
  ])('refuses changed or additional generated constructors', (changed) => {
    expect(() => transformed(changed)).toThrowError(
      'The Typst compiler glue changed its generated callback constructors.',
    );
  });

  it('leaves other modules and the development server outside the adapter', () => {
    expect(
      transformed(source, join(directory, 'another-module.mjs')),
    ).toBeNull();
    expect(typstCspCallbacks().apply).toBe('build');
  });
});
