import { Either } from 'effect';
import { PdfFailure } from './pdf-failures.js';
import { promisePerBytes } from './promise-per-bytes.js';

export { PdfFailure } from './pdf-failures.js';

const mainFile = '/main.typ';

const noDiagnostics = 0;

const diagnosticMessages = /\bmessage:\s*"((?:[^"\\]|\\.)*)"/gu;

const diagnosticHints = /\bhints:\s*\[([^\]]*)\]/gu;

const quotedHint = /"((?:[^"\\]|\\.)*)"/gu;

const debugEscape = /\\(.)/gu;

const runsOfSpace = /\s+/gu;

const started = promisePerBytes<void>();

let firstStart: Promise<void> | undefined;

type CompilerModule = typeof import('@myriaddreamin/typst-ts-web-compiler');

/**
 * The bytes a compile runs on, because this package reads no file: `wasm` is
 * the Typst WebAssembly module, and `fonts` are the faces to typeset with,
 * added to the compiler in the order they are listed.
 */
export type PdfAssets = {
  readonly wasm: Uint8Array;
  readonly fonts: readonly Uint8Array[];
};

/**
 * Compiles Typst source with caller-owned assets, or refuses with
 * {@link PdfFailure}. The compiler gets no file or package access. The module
 * starts asynchronously, once per process, which keeps a browser within its
 * bound on synchronous compilation, and a later `wasm` waits on that first
 * start rather than replacing it. Each call frees its compiler afterwards. A
 * thrown diagnostic keeps its messages and hints, and one this does not
 * recognize is carried whole.
 */
export async function compilePdf(
  source: string,
  assets: PdfAssets,
): Promise<Either.Either<Uint8Array, PdfFailure>> {
  try {
    const compiler = await compilerWith(assets);
    try {
      compiler.add_source(mainFile, source);
      const artifact: unknown = compiler.compile(
        mainFile,
        null,
        'pdf',
        noDiagnostics,
      );
      return artifact instanceof Uint8Array
        ? Either.right(artifact)
        : Either.left(PdfFailure.NoDocument());
    } finally {
      compiler.free();
    }
  } catch (error) {
    return Either.left(PdfFailure.Refused({ sentences: refusalOf(error) }));
  }
}

async function compilerWith(assets: PdfAssets) {
  const compiler = await import('@myriaddreamin/typst-ts-web-compiler');
  await started(assets.wasm, () => moduleStart(assets.wasm, compiler.default));
  const builder = new compiler.TypstCompilerBuilder();
  builder.set_dummy_access_model();
  for (const font of assets.fonts) {
    await builder.add_raw_font(font);
  }
  return builder.build();
}

function moduleStart(
  wasm: Uint8Array,
  initialise: CompilerModule['default'],
): Promise<void> {
  firstStart ??= initialise({ module_or_path: wasm }).then(
    () => undefined,
    (error: unknown) => {
      firstStart = undefined;
      throw error;
    },
  );
  return firstStart;
}

function refusalOf(error: unknown): readonly string[] {
  const reported = typeof error === 'string' ? sentencesIn(error) : [];
  return reported.length > 0
    ? reported
    : [error instanceof Error ? error.message : String(error)];
}

function sentencesIn(reported: string): readonly string[] {
  return [
    ...[...reported.matchAll(diagnosticMessages)].map((found) =>
      readable(found[1]),
    ),
    ...[...reported.matchAll(diagnosticHints)].flatMap((found) =>
      [...found[1].matchAll(quotedHint)].map((hint) => readable(hint[1])),
    ),
  ];
}

function readable(debugged: string): string {
  return debugged
    .replace(debugEscape, (_whole, character: string) =>
      character === '\\' || character === '"' ? character : ' ',
    )
    .replace(runsOfSpace, ' ')
    .trim();
}
