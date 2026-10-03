{ lib, stdenv, rustPlatform, cargo, rustc, lld, wabt
  # The directory holding the export crate's Cargo.toml, Cargo.lock and src.
, root
  # The logic crate's directory under root.
, logic
  # The cdylib's crate name, which names the module under lib/.
, library
  # The locked crate whose version the derivation carries.
, upstream
  # The calls the module exports beside its memory and the linker globals.
, exports
, pname
, meta
}:

# Every Rust WebAssembly module Saerskriven ships is built here, so the ban on
# unsafe Rust (owner rulings, 2026-10-02, #622 and #640) is part of each
# module's build rather than lines each derivation repeats. A module's
# default.nix names its crates and its calls, and its nx project hashes this
# file and the two scripts beside it.
let
  lockFile = root + "/Cargo.lock";
  lock = builtins.fromTOML (builtins.readFile lockFile);
  locked = lib.findFirst (crate: crate.name == upstream) null lock.package;
  module = "${library}.wasm";
  # The nix expressions are not inputs to the compile, so naming the files
  # keeps a change to them from rebuilding the module.
  sources = lib.fileset.toSource {
    inherit root;
    fileset = lib.fileset.unions [
      (root + "/Cargo.toml")
      lockFile
      (root + "/src")
      (root + "/${logic}")
    ];
  };
in
stdenv.mkDerivation {
  inherit pname meta;
  version = locked.version;
  src = sources;

  # Every crate comes from the checksums in Cargo.lock, fetched before the
  # build. --offline then fails loudly rather than reaching the registry.
  cargoDeps = rustPlatform.importCargoLock { inherit lockFile; };

  # nixpkgs' rustc ships no rust-lld, and wasm32-unknown-unknown links with
  # lld rather than the stdenv's cc.
  nativeBuildInputs = [ rustPlatform.cargoSetupHook cargo rustc lld ];

  # The ban is checked before the compile, by unsafe-ban.sh, with the export
  # crate at the source root and the logic crate beneath it.
  preBuild = ''
    bash ${./unsafe-ban.sh} . ${lib.escapeShellArg logic}
  '';

  buildPhase = ''
    runHook preBuild
    cargo build --release --offline --frozen --target wasm32-unknown-unknown
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    install -Dm444 \
      target/wasm32-unknown-unknown/release/${module} \
      "$out/lib/${module}"
    runHook postInstall
  '';

  # The built module imports nothing and exports exactly the calls its driver
  # knows, checked by wasm-surface.sh with wabt, which only these builds fetch.
  doInstallCheck = true;
  nativeInstallCheckInputs = [ wabt ];
  installCheckPhase = ''
    runHook preInstallCheck
    bash ${./wasm-surface.sh} "$out/lib/${module}" \
      memory ${lib.escapeShellArgs exports} __data_end __heap_base
    runHook postInstallCheck
  '';

  # The fixup phase's strip and ELF patching do not read wasm.
  dontStrip = true;
  dontPatchELF = true;
}
