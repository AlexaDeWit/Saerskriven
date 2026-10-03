import { brotliVariable, brotliWasmAsset } from './build-assets.js';

const stop = (sentence: string): never => {
  throw new Error(sentence);
};

describe('the brotli module a build carries', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is the file the variable names', () => {
    vi.stubEnv(brotliVariable, import.meta.filename);
    expect(brotliWasmAsset(stop)).toBe(import.meta.filename);
  });

  it.each([undefined, ''])(
    'is refused where the variable is %p, naming the build that writes it',
    (value) => {
      vi.stubEnv(brotliVariable, value);
      expect(() => brotliWasmAsset(stop)).toThrow('nix build .#brotli-wasm');
    },
  );

  it('is refused where the variable names no file', () => {
    vi.stubEnv(brotliVariable, `${import.meta.filename}.absent`);
    expect(() => brotliWasmAsset(stop)).toThrow(
      `${import.meta.filename}.absent`,
    );
  });
});
