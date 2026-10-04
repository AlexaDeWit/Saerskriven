import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

const gluePath =
  '/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler.mjs';

const noArguments = 'new Function(getStringFromWasm0(arg0, arg1))';
const withArguments =
  'new Function(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3))';

const callbacks = `function studioTypstCallback(parameters, body) {
  if (parameters === 'path' && body === 'return path') {
    return (path) => path;
  }
  if (parameters !== '') {
    throw new Error('Unsupported Typst dummy callback parameters.');
  }
  switch (body) {
    case 'return 0':
      return () => 0;
    case 'return true':
      return () => true;
    case "throw new Error('Dummy AccessModel, please initialize compiler with withAccessModel()')":
      return () => { throw new Error('Dummy AccessModel, please initialize compiler with withAccessModel()'); };
    case "throw new Error('Dummy Registry, please initialize compiler with withPackageRegistry()')":
      return () => { throw new Error('Dummy Registry, please initialize compiler with withPackageRegistry()'); };
    default:
      throw new Error('Unsupported Typst dummy callback body.');
  }
}
`;

/** The five fixed bodies come from the {@link https://github.com/Myriad-Dreamin/typst.ts/blob/v0.7.0/packages/compiler/src/builder.rs Typst 0.7.0 builder}. */
export const typstCspCallbacks = (): Plugin => ({
  name: 'studio-typst-csp-callbacks',
  apply: 'build',
  transform(code, id) {
    if (!id.endsWith(gluePath)) {
      return null;
    }
    const manifest: unknown = JSON.parse(
      readFileSync(join(dirname(id), '../package.json'), 'utf8'),
    );
    if (
      typeof manifest !== 'object' ||
      manifest === null ||
      !('version' in manifest) ||
      manifest.version !== '0.7.0'
    ) {
      this.error(
        'Review the Typst CSP callbacks before changing the compiler version.',
      );
    }
    if (
      code.split(noArguments).length !== 2 ||
      code.split(withArguments).length !== 2 ||
      [...code.matchAll(/\bnew\s+Function\s*\(/gu)].length !== 2
    ) {
      this.error(
        'The Typst compiler glue changed its generated callback constructors.',
      );
    }
    return {
      code:
        callbacks +
        code
          .replace(
            noArguments,
            "studioTypstCallback('', getStringFromWasm0(arg0, arg1))",
          )
          .replace(
            withArguments,
            'studioTypstCallback(getStringFromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3))',
          ),
      map: null,
    };
  },
});
