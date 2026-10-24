import type { PdfAssets } from '@saerskriven/render/pdf';
import { drawingFace, ledBy } from '@saerskriven/render/png';
import type { ResvgAssets } from '@saerskriven/render/resvg';
import { Result } from 'effect';
import brotliWasmUrl from 'virtual:saerskriven-brotli-wasm?url';
import resvgWasmUrl from 'virtual:saerskriven-resvg-wasm?url';
import { renderFaces } from 'virtual:saerskriven-render-faces';
import typstWasmUrl from 'virtual:saerskriven-typst-wasm?url';
import { AssetFailure } from '../asset-failure.js';
import { reasonOf } from '../reason.js';

type Assets = {
  readonly wasm: Uint8Array;
  readonly fonts: readonly Uint8Array[];
};

type Face = {
  readonly name: string;
  readonly bytes: Uint8Array;
};

type Loaded<Value> = () => Promise<Result.Result<Value, AssetFailure>>;

const subject = 'this studio build';

/**
 * The Typst compiler module and the faces in the compiler's order. Each is
 * fetched once per session after a successful read, the faces shared with
 * {@link loadPngAssets}.
 */
export function loadPdfAssets(): Promise<
  Result.Result<PdfAssets, AssetFailure>
> {
  return assembled(typstModule, (faces) => Result.succeed(faces));
}

/**
 * The rasterizer module and the faces, led by the face the drawings are
 * lettered in. The rasterizer letters an unloaded family in the first face it
 * is given, so a build without that face is refused.
 */
export function loadPngAssets(): Promise<
  Result.Result<ResvgAssets, AssetFailure>
> {
  return assembled(resvgModule, (faces) =>
    Result.mapError(
      ledBy(faces, (face) => face.name, drawingFace, subject),
      () => AssetFailure.FaceMissing({ face: drawingFace }),
    ),
  );
}

/**
 * The brotli module a share link is written and read with, fetched once per
 * session after a successful read and shared by every link.
 */
export const loadBrotliModule: Loaded<Uint8Array> = once(() =>
  fetchBytes(brotliWasmUrl),
);

const faces: Loaded<readonly Face[]> = once(() =>
  firstFailureOrAll(
    renderFaces.map(async (face) =>
      Result.map(await fetchBytes(face.url), (bytes) => ({
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
  ) => Result.Result<readonly Face[], AssetFailure>,
): Promise<Result.Result<Assets, AssetFailure>> {
  const [wasm, loaded] = await Promise.all([module(), faces()]);
  if (Result.isFailure(wasm)) {
    return Result.fail(wasm.failure);
  }
  if (Result.isFailure(loaded)) {
    return Result.fail(loaded.failure);
  }
  return Result.map(lettered(loaded.success), (ordered) => ({
    wasm: wasm.success,
    fonts: ordered.map((face) => face.bytes),
  }));
}

function firstFailureOrAll<Value>(
  loads: readonly Promise<Result.Result<Value, AssetFailure>>[],
): Promise<Result.Result<Value[], AssetFailure>> {
  const firstFailure = new Promise<Result.Result<Value[], AssetFailure>>(
    (resolve) => {
      const failed = async (
        load: Promise<Result.Result<Value, AssetFailure>>,
      ): Promise<void> => {
        const outcome = await load;
        if (Result.isFailure(outcome)) {
          resolve(Result.fail(outcome.failure));
        }
      };
      void Promise.all(loads.map(failed));
    },
  );
  return Promise.race([
    firstFailure,
    Promise.all(loads).then((outcomes) => Result.all(outcomes)),
  ]);
}

function once<Value>(load: Loaded<Value>): Loaded<Value> {
  let held: Value | undefined;
  let loading: Promise<Result.Result<Value, AssetFailure>> | undefined;
  return async () => {
    if (held !== undefined) {
      return Result.succeed(held);
    }
    loading ??= load();
    const outcome = await loading;
    if (Result.isSuccess(outcome)) {
      held = outcome.success;
    } else {
      loading = undefined;
    }
    return outcome;
  };
}

async function fetchBytes(
  url: string,
): Promise<Result.Result<Uint8Array, AssetFailure>> {
  const response = await guarded(() => fetch(url));
  if (Result.isFailure(response)) {
    return Result.fail(response.failure);
  }
  if (!response.success.ok) {
    return Result.fail(
      AssetFailure.Answered({ url, status: response.success.status }),
    );
  }
  const body = response.success;
  return guarded(async () => new Uint8Array(await body.arrayBuffer()));
}

async function guarded<Value>(
  work: () => Promise<Value>,
): Promise<Result.Result<Value, AssetFailure>> {
  try {
    return Result.succeed(await work());
  } catch (cause) {
    return Result.fail(AssetFailure.Unavailable({ reason: reasonOf(cause) }));
  }
}
