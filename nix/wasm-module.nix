{ lib, stdenv, rustPlatform, cargo, rustc, lld, wabt, jq
  # One module's facts: the attribute set its file under nix/ holds, which
  # flake.nix imports and hands here.
, module
}:

# Every Rust WebAssembly module Saerskriven ships is built here, under the ban
# on unsafe Rust (owner rulings, 2026-10-02, #622 and #640). A module's file
# is data rather than a derivation, so no module builds itself or drops a
# phase of this one. This file, flake.nix, the two scripts beside it and the
# module files are the ban's trust root (CODING.md, Rust modules), and each
# module's nx project hashes all of them.
let
  facts = [
    "dependencies" "description" "exports" "homepage" "library" "licenses"
    "logic" "pname" "root" "upstream"
  ];
  # The directory holding the export crate's Cargo.toml, Cargo.lock and src.
  root = module.root;
  # The logic crate's directory under root.
  logic = module.logic;
  # The cdylib's crate name, which names the module under lib/.
  file = "${module.library}.wasm";
  built = "target/wasm32-unknown-unknown/release/${file}";
  lockFile = root + "/Cargo.lock";
  lock = builtins.fromTOML (builtins.readFile lockFile);
  # The locked crate whose version the derivation carries.
  locked = lib.findFirst (crate: crate.name == module.upstream) null lock.package;
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
assert lib.assertMsg
  (builtins.isAttrs module && builtins.attrNames module == facts)
  "a module file under nix/ is an attribute set of exactly ${toString facts}";
stdenv.mkDerivation {
  inherit (module) pname;
  version = locked.version;
  src = sources;

  # Every crate comes from the checksums in Cargo.lock, fetched before the
  # build. --offline then fails loudly rather than reaching the registry.
  cargoDeps = rustPlatform.importCargoLock { inherit lockFile; };

  # nixpkgs' rustc ships no rust-lld, and wasm32-unknown-unknown links with
  # lld rather than the stdenv's cc. jq reads the guard's cargo metadata.
  nativeBuildInputs = [ rustPlatform.cargoSetupHook cargo rustc lld jq ];

  # The ban is checked before the compile, by unsafe-ban.sh, with the export
  # crate at the source root, the logic crate beneath it, and the names of the
  # logic crate's direct dependencies, the only crates whose macros it reaches.
  preBuild = ''
    bash ${./unsafe-ban.sh} . ${lib.escapeShellArg logic} ${lib.escapeShellArgs module.dependencies}
  '';

  buildPhase = ''
    runHook preBuild
    cargo build --release --offline --frozen --target wasm32-unknown-unknown
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    install -Dm444 ${lib.escapeShellArg built} "$out"/lib/${lib.escapeShellArg file}
    runHook postInstall
  '';

  # The built module imports nothing and exports exactly the calls its driver
  # knows, checked by wasm-surface.sh with wabt, which only these builds fetch.
  doInstallCheck = true;
  nativeInstallCheckInputs = [ wabt ];
  installCheckPhase = ''
    runHook preInstallCheck
    bash ${./wasm-surface.sh} "$out"/lib/${lib.escapeShellArg file} \
      memory ${lib.escapeShellArgs module.exports} __data_end __heap_base
    runHook postInstallCheck
  '';

  # The fixup phase's strip and ELF patching do not read wasm.
  dontStrip = true;
  dontPatchELF = true;

  meta = {
    inherit (module) description homepage;
    license = map (name: lib.licenses.${name}) module.licenses;
    platforms = lib.platforms.all;
  };
}
