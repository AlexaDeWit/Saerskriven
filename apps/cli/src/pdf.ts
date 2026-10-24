import {
  compilePdf as compileTypst,
  PdfFailure,
} from '@saerskriven/render/pdf';
import { Result } from 'effect';
import { wasmAssets, type WasmAssets } from './assets.js';

const wasmModule = 'typst_ts_web_compiler_bg.wasm';

/**
 * Typst source compiled to a PDF with the faces in name order, or one line
 * saying why it was not.
 */
export function compilePdf(
  source: string,
  assets: string,
): Promise<Result.Result<Uint8Array, string>> {
  return Result.match(wasmAssets(assets, wasmModule), {
    onFailure: (reason) =>
      Promise.resolve(Result.fail(`cannot compile the PDF: ${reason}`)),
    onSuccess: (found) => typeset(source, found),
  });
}

async function typeset(
  source: string,
  assets: WasmAssets,
): Promise<Result.Result<Uint8Array, string>> {
  return Result.mapError(await compileTypst(source, assets), reported);
}

function reported(failure: PdfFailure): string {
  return PdfFailure.$match(failure, {
    Refused: ({ sentences }) =>
      `cannot compile the PDF: ${sentences.join('; ')}`,
    NoDocument: () => 'the Typst compiler produced no PDF',
  });
}
