import { flakeModuleAsset, type FlakeModule } from './build-assets.js';
import { stop } from './fixtures.js';

const module: FlakeModule = {
  variable: 'SAERSKRIVEN_SPEC_WASM',
  output: 'spec-wasm',
  file: 'spec.wasm',
  holds: 'spec module',
};

describe('a flake-built module a build carries', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is the file the variable names', () => {
    vi.stubEnv(module.variable, import.meta.filename);
    expect(flakeModuleAsset(module, stop)).toBe(import.meta.filename);
  });

  it.each([undefined, ''])(
    'is refused where the variable is %p, naming the build that writes it',
    (value) => {
      vi.stubEnv(module.variable, value);
      expect(() => flakeModuleAsset(module, stop)).toThrow(
        'nix build .#spec-wasm',
      );
    },
  );

  it('is refused where the variable names no file', () => {
    vi.stubEnv(module.variable, `${import.meta.filename}.absent`);
    expect(() => flakeModuleAsset(module, stop)).toThrow(
      `${import.meta.filename}.absent`,
    );
  });
});
