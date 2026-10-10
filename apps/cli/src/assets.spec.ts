import { Either } from 'effect';
import { runtimeAssets, wasmAssets, wasmModule } from './assets.js';
import { fakeAssets, scratchDirectory } from './cli.fixtures.js';
import { resvgWasmFile } from './png.js';

const executable = vi.hoisted(() => ({
  embedded: new Map<string, string>(),
}));

vi.mock('node:sea', () => ({
  isSea: (): boolean => true,
  getAssetKeys: (): string[] => [...executable.embedded.keys()],
  getAsset: (key: string): ArrayBuffer => {
    const held = executable.embedded.get(key);
    if (held === undefined) {
      throw new Error(`no asset ${key}`);
    }
    return new TextEncoder().encode(held).buffer;
  },
}));

const textOf = (bytes: Uint8Array): string => Buffer.from(bytes).toString();

describe('the assets a single executable reads', () => {
  beforeEach(() => {
    executable.embedded.clear();
  });

  it('come from what it embeds, with the faces in name order', () => {
    executable.embedded.set('assets/embedded.wasm', 'embedded module');
    executable.embedded.set('assets/b.ttf', 'face b');
    executable.embedded.set('assets/a.ttf', 'face a');
    executable.embedded.set('elsewhere/c.ttf', 'not an asset of ours');
    expect(
      Either.map(wasmAssets(runtimeAssets, 'embedded.wasm'), (assets) => ({
        wasm: textOf(assets.wasm),
        fonts: assets.fonts.map(textOf),
      })),
    ).toEqual(
      Either.right({ wasm: 'embedded module', fonts: ['face a', 'face b'] }),
    );
  });

  it('refuses a module the executable does not embed', () => {
    expect(Either.isLeft(wasmModule(runtimeAssets, 'absent.wasm'))).toBe(true);
  });

  it('still come from disk for any other directory', () => {
    const directory = fakeAssets(scratchDirectory('assets'), ['on-disk.ttf']);
    expect(
      Either.map(wasmAssets(directory, resvgWasmFile), (assets) =>
        assets.fonts.map(textOf),
      ),
    ).toEqual(Either.right(['face:on-disk.ttf']));
  });
});
