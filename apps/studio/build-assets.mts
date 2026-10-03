import { brotliWasmAsset } from '@saerskriven/formats/build-assets';
import { dirname, resolve } from 'node:path';
import {
  resvgWasmAsset,
  typstFontAssets,
  typstWasmModule,
  type TypstFontAsset,
} from '@saerskriven/render/build-assets';

const publicId = 'virtual:saerskriven-render-faces';
const resolvedId = `\0${publicId}`;
const typstId = 'virtual:saerskriven-typst-wasm?url';
const resvgId = 'virtual:saerskriven-resvg-wasm?url';
const brotliId = 'virtual:saerskriven-brotli-wasm?url';

export const refuseStudioBuild = (sentence: string): never => {
  throw new Error(
    `${sentence} Run the studio inside the flake shell: nix develop --command pnpm nx build @saerskriven/studio`,
  );
};

const refuseUnbuilt =
  (project: string) =>
  (sentence: string): never => {
    throw new Error(
      `${sentence} Run pnpm nx build ${project}, which every target carrying the module depends on.`,
    );
  };

const locatedOnce = (locate: () => string): (() => string) => {
  let located: string | undefined;
  return () => (located ??= locate());
};

const wasmModules = new Map<string, () => string>([
  [typstId, () => typstWasmModule],
  [resvgId, locatedOnce(() => resvgWasmAsset(refuseUnbuilt('resvg-wasm')))],
  [brotliId, locatedOnce(() => brotliWasmAsset(refuseUnbuilt('brotli-wasm')))],
]);

const faceId = (index: number): string =>
  `virtual:saerskriven-render-face-${String(index)}?url`;

const moduleFor = (assets: readonly TypstFontAsset[]): string => {
  const imports = assets.map(
    (_asset, index) =>
      `import face${String(index)} from ${JSON.stringify(faceId(index))};`,
  );
  const faces = assets.map(
    (asset, index) =>
      `{ name: ${JSON.stringify(asset.name)}, url: face${String(index)} }`,
  );
  return `${imports.join('\n')}
export const renderFaces = [${faces.join(', ')}];\n`;
};

/**
 * The Nix-provided Liberation faces and three WebAssembly modules as Vite
 * assets: the compiler a PDF is typeset by and the rasterizer a PNG is drawn
 * by, which `@saerskriven/render/build-assets` names with the faces so the CLI
 * and the studio cannot carry different ones, and the brotli codec
 * `@saerskriven/formats/build-assets` names.
 *
 * The faces arrive in the Typst compiler's order, which the PNG loader leads
 * with the face drawings are set in instead.
 *
 * A flake-built module's path is read when the build first asks for it, not
 * when this configuration loads. Nx loads it to build the project graph before
 * any task has run, so on a cold checkout an eager read would refuse every nx
 * command, the module's own build included. A module that is not there is
 * refused with the nx build that writes it, since the flake names the path
 * and that build puts the file there.
 */
export function buildAssets() {
  const assets = typstFontAssets(refuseStudioBuild);
  const faces = new Map(
    assets.map((asset, index) => [faceId(index), `${asset.from}?url`]),
  );

  return {
    name: 'saerskriven-build-assets',
    resolveId(id: string): string | undefined {
      if (id === publicId) {
        return resolvedId;
      }
      const located = wasmModules.get(id);
      return located === undefined ? faces.get(id) : `${located()}?url`;
    },
    load(id: string): string | undefined {
      return id === resolvedId ? moduleFor(assets) : undefined;
    },
    config(): {
      readonly server: { readonly fs: { readonly allow: string[] } };
    } {
      return {
        server: {
          fs: {
            allow: [
              resolve(import.meta.dirname, '../..'),
              ...new Set(assets.map((asset) => dirname(asset.from))),
            ],
          },
        },
      };
    },
  };
}
