import {
  compilePdf as compileTypst,
  PdfFailure,
} from '@saerskriven/render/pdf';
import { Either } from 'effect';
import { wasmAssets, type WasmAssets } from './assets.js';

const wasmModule = 'typst_ts_web_compiler_bg.wasm';

/**
 * Typst source compiled to a PDF with the faces in name order, or one line
 * saying why it was not.
 */
export function compilePdf(
  source: string,
  assets: string,
): Promise<Either.Either<Uint8Array, string>> {
  return Either.match(wasmAssets(assets, wasmModule), {
    onLeft: (reason) =>
      Promise.resolve(Either.left(`cannot compile the PDF: ${reason}`)),
    onRight: (found) => typeset(source, found),
  });
}

async function typeset(
  source: string,
  assets: WasmAssets,
): Promise<Either.Either<Uint8Array, string>> {
  return Either.mapLeft(await compileTypst(source, assets), reported);
}

function reported(failure: PdfFailure): string {
  return PdfFailure.$match(failure, {
    Refused: ({ sentences }) =>
      `cannot compile the PDF: ${sentences.join('; ')}`,
    NoDocument: () => 'the Typst compiler produced no PDF',
  });
}
