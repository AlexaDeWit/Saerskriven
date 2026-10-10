import type { PdfAssets } from '@saerskriven/render/pdf';
import { drawingFace, ledBy } from '@saerskriven/render/png';
import type { ResvgAssets } from '@saerskriven/render/resvg';
import { Either } from 'effect';
import resvgWasmUrl from 'virtual:saerskriven-resvg-wasm?url';
import { renderFaces } from 'virtual:saerskriven-render-faces';
import typstWasmUrl from 'virtual:saerskriven-typst-wasm?url';
import { AssetFailure } from '../asset-failure.js';
import { fetchBytes, once, type Loaded } from './asset-loader.js';

export { loadBrotliModule } from './brotli-asset.js';

type Assets = {
  readonly wasm: Uint8Array;
  readonly fonts: readonly Uint8Array[];
};

type Face = {
  readonly name: string;
  readonly bytes: Uint8Array;
};

const subject = 'this studio build';

/**
 * The Typst compiler module and the faces in the compiler's order. Each is
 * fetched once per session after a successful read, the faces shared with
 * {@link loadPngAssets}.
 */
export function loadPdfAssets(): Promise<
  Either.Either<PdfAssets, AssetFailure>
> {
  return assembled(typstModule, (faces) => Either.right(faces));
}

/**
 * The rasterizer module and the faces, led by the face the drawings are
 * lettered in. The rasterizer letters an unloaded family in the first face it
 * is given, so a build without that face is refused.
 */
export function loadPngAssets(): Promise<
  Either.Either<ResvgAssets, AssetFailure>
> {
  return assembled(resvgModule, (faces) =>
    Either.mapLeft(
      ledBy(faces, (face) => face.name, drawingFace, subject),
      () => AssetFailure.FaceMissing({ face: drawingFace }),
    ),
  );
}

const faces: Loaded<readonly Face[]> = once(() =>
  firstFailureOrAll(
    renderFaces.map(async (face) =>
      Either.map(await fetchBytes(face.url), (bytes) => ({
        name: face.name,
        bytes,
      })),
    ),
  ),
);

const typstModule: Loaded<Uint8Array> = once(() => fetchBytes(typstWasmUrl));

const resvgModule: Loaded<Uint8Array> = once(() => fetchBytes(resvgWasmUrl));

async function assembled(
  module: Loaded<Uint8Array>,
  lettered: (
    faces: readonly Face[],
  ) => Either.Either<readonly Face[], AssetFailure>,
): Promise<Either.Either<Assets, AssetFailure>> {
  const [wasm, loaded] = await Promise.all([module(), faces()]);
  if (Either.isLeft(wasm)) {
    return Either.left(wasm.left);
  }
  if (Either.isLeft(loaded)) {
    return Either.left(loaded.left);
  }
  return Either.map(lettered(loaded.right), (ordered) => ({
    wasm: wasm.right,
    fonts: ordered.map((face) => face.bytes),
  }));
}

function firstFailureOrAll<Value>(
  loads: readonly Promise<Either.Either<Value, AssetFailure>>[],
): Promise<Either.Either<Value[], AssetFailure>> {
  const firstFailure = new Promise<Either.Either<Value[], AssetFailure>>(
    (resolve) => {
      const failed = async (
        load: Promise<Either.Either<Value, AssetFailure>>,
      ): Promise<void> => {
        const outcome = await load;
        if (Either.isLeft(outcome)) {
          resolve(Either.left(outcome.left));
        }
      };
      void Promise.all(loads.map(failed));
    },
  );
  return Promise.race([
    firstFailure,
    Promise.all(loads).then((outcomes) => Either.all(outcomes)),
  ]);
}
