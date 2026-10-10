{ lib, stdenv, stdenvNoCC, fetchurl, patchelf }:

let
  release = builtins.fromJSON (builtins.readFile ./release.json);
  system = stdenvNoCC.hostPlatform.system;
  asset = release.assets.${system} or
    (throw "Saerskriven has no release binary for ${system}. Supported systems: ${lib.concatStringsSep ", " (builtins.attrNames release.assets)}");
in stdenvNoCC.mkDerivation {
  pname = "saerskriven";
  inherit (release) version;

  src = fetchurl {
    url = "https://github.com/AlexaDeWit/Saerskriven/releases/download/v${release.version}/${release.binaryName}-${release.version}-${asset.target}";
    sha256 = asset.hash;
  };

  dontUnpack = true;
  # The release bytes are kept but for the loader and the run path below.
  # Fixup would strip them, and on macOS change the signed Mach-O bytes.
  dontFixup = true;
  nativeBuildInputs = lib.optionals stdenvNoCC.hostPlatform.isLinux [ patchelf ];

  installPhase = ''
    runHook preInstall
    mkdir -p "$out/bin"
    install -m 755 "$src" "$out/bin/saer"
  '' + lib.optionalString stdenvNoCC.hostPlatform.isLinux ''
    # glibc's loader and libraries, and GCC's libstdc++, libatomic and
    # libgcc_s, from the caller's nixpkgs.
    patchelf \
      --set-interpreter "${stdenv.cc.bintools.dynamicLinker}" \
      --set-rpath "${lib.makeLibraryPath [ stdenv.cc.libc stdenv.cc.cc.lib ]}" \
      "$out/bin/saer"
  '' + ''
    ln -s saer "$out/bin/saerskriven"
    runHook postInstall
  '';

  meta = {
    description = "Threat model validation and rendering CLI";
    homepage = "https://github.com/AlexaDeWit/Saerskriven";
    license = lib.licenses.asl20;
    mainProgram = "saer";
    platforms = builtins.attrNames release.assets;
    sourceProvenance = [ lib.sourceTypes.binaryNativeCode ];
  };
}
