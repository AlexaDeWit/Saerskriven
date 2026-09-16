import type { PdfAssets } from '@saerskriven/render/pdf';
import { drawingFace, ledBy } from '@saerskriven/render/png';
import type { ResvgAssets } from '@saerskriven/render/resvg';
import { Data, Either } from 'effect';
import resvgWasmUrl from 'virtual:saerskriven-resvg-wasm?url';
import { renderFaces } from 'virtual:saerskriven-render-faces';
import typstWasmUrl from 'virtual:saerskriven-typst-wasm?url';
import { reasonOf } from '../reason.js';

/** Why the browser could not load the bytes a projection is drawn with. */
export type RenderAssetFailure = Data.TaggedEnum<{
  Unavailable: { readonly reason: string };
}>;

/** Constructors for {@link RenderAssetFailure}. */
export const RenderAssetFailure = Data.taggedEnum<RenderAssetFailure>();

type Assets = {
  readonly wasm: Uint8Array;
  readonly fonts: readonly Uint8Array[];
};

type Face = {
  readonly name: string;
  readonly bytes: Uint8Array;
};

type Loaded<Value> = () => Promise<Either.Either<Value, RenderAssetFailure>>;

const subject = 'this studio build';

/**
 * The Typst compiler module and the faces in the compiler's order. Each is
 * fetched once per session after a successful read, the faces shared with
 * {@link loadPngAssets}.
 */
export function loadPdfAssets(): Promise<
  Either.Either<PdfAssets, RenderAssetFailure>
> {
  return assembled(typstModule, (faces) => Either.right(faces));
}

/**
 * The rasterizer module and the faces, led by the face the drawings are
 * lettered in. The rasterizer letters an unloaded family in the first face it
 * is given, so a build without that face is refused.
 */
export function loadPngAssets(): Promise<
  Either.Either<ResvgAssets, RenderAssetFailure>
> {
  return assembled(resvgModule, (faces) =>
    ledBy(faces, (face) => face.name, drawingFace, subject),
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
  lettered: (faces: readonly Face[]) => Either.Either<readonly Face[], string>,
): Promise<Either.Either<Assets, RenderAssetFailure>> {
  const [wasm, loaded] = await Promise.all([module(), faces()]);
  if (Either.isLeft(wasm)) {
    return Either.left(wasm.left);
  }
  if (Either.isLeft(loaded)) {
    return Either.left(loaded.left);
  }
  return Either.mapBoth(lettered(loaded.right), {
    onLeft: (reason) => RenderAssetFailure.Unavailable({ reason }),
    onRight: (ordered) => ({
      wasm: wasm.right,
      fonts: ordered.map((face) => face.bytes),
    }),
  });
}

function firstFailureOrAll<Value>(
  loads: readonly Promise<Either.Either<Value, RenderAssetFailure>>[],
): Promise<Either.Either<Value[], RenderAssetFailure>> {
  const firstFailure = new Promise<Either.Either<Value[], RenderAssetFailure>>(
    (resolve) => {
      const failed = async (
        load: Promise<Either.Either<Value, RenderAssetFailure>>,
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

function once<Value>(load: Loaded<Value>): Loaded<Value> {
  let held: Value | undefined;
  let loading: Promise<Either.Either<Value, RenderAssetFailure>> | undefined;
  return async () => {
    if (held !== undefined) {
      return Either.right(held);
    }
    loading ??= load();
    const outcome = await loading;
    if (Either.isRight(outcome)) {
      held = outcome.right;
    } else {
      loading = undefined;
    }
    return outcome;
  };
}

async function fetchBytes(
  url: string,
): Promise<Either.Either<Uint8Array, RenderAssetFailure>> {
  const response = await guarded(() => fetch(url));
  if (Either.isLeft(response)) {
    return Either.left(response.left);
  }
  if (!response.right.ok) {
    return Either.left(
      RenderAssetFailure.Unavailable({
        reason: `${url} answered ${String(response.right.status)}.`,
      }),
    );
  }
  const body = response.right;
  return guarded(async () => new Uint8Array(await body.arrayBuffer()));
}

async function guarded<Value>(
  work: () => Promise<Value>,
): Promise<Either.Either<Value, RenderAssetFailure>> {
  try {
    return Either.right(await work());
  } catch (cause) {
    return Either.left(
      RenderAssetFailure.Unavailable({ reason: reasonOf(cause) }),
    );
  }
}
