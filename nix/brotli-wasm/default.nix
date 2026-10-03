{ lib, stdenv, rustPlatform, cargo, rustc, lld }:

# The rasterizer's derivation in ../resvg-wasm is the same shape and says why
# each piece is there. The two stay separate files so that a change to one
# module's build leaves the other's sources, and the nx cache keyed on them,
# untouched.
let
  lock = builtins.fromTOML (builtins.readFile ./Cargo.lock);
  locked = lib.findFirst (crate: crate.name == "brotli") null lock.package;
  sources = lib.fileset.toSource {
    root = ./.;
    fileset = lib.fileset.unions [ ./Cargo.toml ./Cargo.lock ./src ];
  };
in
stdenv.mkDerivation {
  pname = "saerskriven-brotli-wasm";
  version = locked.version;
  src = sources;

  cargoDeps = rustPlatform.importCargoLock { lockFile = ./Cargo.lock; };

  nativeBuildInputs = [ rustPlatform.cargoSetupHook cargo rustc lld ];

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

  dontStrip = true;
  dontPatchELF = true;

  meta = {
    description = "Brotli encoder and bounded decoder built from the brotli crate as WebAssembly";
    homepage = "https://github.com/dropbox/rust-brotli";
    license = [ lib.licenses.bsd3 lib.licenses.mit ];
    platforms = lib.platforms.all;
  };
}
