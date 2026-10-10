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
  '' + lib.optionalString stdenvNoCC.hostPlatform.isLinux ''
    # Releases through v0.8.3 locate their payload from EOF, so patch their
    # ELF separately. Node executables carry an ELF note and are patched whole.
    read -r magic name_hash < <(tail -c 16 "$src" | od --endian=little -An -tx4 -N8)
    file_size=$(stat -c %s "$src")
    payload_size=0
    if [ "$magic" = 0000501e ] && [ "$name_hash" = 000002a7 ]; then
      read -r payload_size < <(tail -c 8 "$src" | od --endian=little -An -tu8)
      if [ "$payload_size" -le 16 ] || [ "$payload_size" -ge "$file_size" ]; then
        echo "Unsupported Saerskriven ELF payload trailer." >&2
        exit 1
      fi
    fi
    head -c "$((file_size - payload_size))" "$src" > "$out/bin/saer"
    # glibc's loader and libraries, and GCC's libstdc++, libatomic and
    # libgcc_s, from the caller's nixpkgs.
    patchelf \
      --set-interpreter "${stdenv.cc.bintools.dynamicLinker}" \
      --set-rpath "${lib.makeLibraryPath [ stdenv.cc.libc stdenv.cc.cc.lib ]}" \
      "$out/bin/saer"
    tail -c "$payload_size" "$src" >> "$out/bin/saer"
  '' + lib.optionalString stdenvNoCC.hostPlatform.isDarwin ''
    cp "$src" "$out/bin/saer"
  '' + ''
    chmod 755 "$out/bin/saer"
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
