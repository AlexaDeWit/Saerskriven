{ lib, stdenv, rustPlatform, cargo, rustc, lld, wabt }:

# The rasterizer's derivation in ../resvg-wasm is the same shape, without the
# ban's two checks until #640, and says why each piece is there. The two stay
# separate files so that a change to one module's build leaves the other's
# sources, and the nx cache keyed on them, untouched.
let
  lock = builtins.fromTOML (builtins.readFile ./Cargo.lock);
  locked = lib.findFirst (crate: crate.name == "brotli") null lock.package;
  sources = lib.fileset.toSource {
    root = ./.;
    fileset = lib.fileset.unions [ ./Cargo.toml ./Cargo.lock ./src ./codec ];
  };
in
stdenv.mkDerivation {
  pname = "saerskriven-brotli-wasm";
  version = locked.version;
  src = sources;

  cargoDeps = rustPlatform.importCargoLock { lockFile = ./Cargo.lock; };

  nativeBuildInputs = [ rustPlatform.cargoSetupHook cargo rustc lld ];

  # The ban on unsafe Rust (#622, #640) is checked before the compile, by
  # nix/unsafe-ban.sh, which #640 points resvg's build at too. `.` is the
  # export crate and `codec` the logic crate.
  preBuild = ''
    bash ${../unsafe-ban.sh} . codec
  '';

  buildPhase = ''
    runHook preBuild
    cargo build --release --offline --frozen --target wasm32-unknown-unknown
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    install -Dm444 \
      target/wasm32-unknown-unknown/release/saerskriven_brotli.wasm \
      "$out/lib/saerskriven_brotli.wasm"
    runHook postInstall
  '';

  # The built module imports nothing and exports exactly the calls the
  # driver knows, checked by nix/wasm-surface.sh with wabt, which only this
  # build fetches.
  doInstallCheck = true;
  nativeInstallCheckInputs = [ wabt ];
  installCheckPhase = ''
    runHook preInstallCheck
    bash ${../wasm-surface.sh} "$out/lib/saerskriven_brotli.wasm" \
      memory input compress decompress output output_length \
      __data_end __heap_base
    runHook postInstallCheck
  '';

  dontStrip = true;
  dontPatchELF = true;

  meta = {
    description = "Brotli encoder and bounded decoder built from the brotli crate as WebAssembly";
    homepage = "https://github.com/dropbox/rust-brotli";
    license = [ lib.licenses.bsd3 lib.licenses.mit ];
    platforms = lib.platforms.all;
  };
}
