{ lib, callPackage }:

# The brotli codec, built by ../wasm-module.nix, which holds the ban on unsafe
# Rust and says why each piece of the derivation is there. `.` is the export
# crate and `codec` the logic crate.
callPackage ../wasm-module.nix {
  pname = "saerskriven-brotli-wasm";
  root = ./.;
  logic = "codec";
  library = "saerskriven_brotli";
  upstream = "brotli";
  exports = [ "input" "compress" "decompress" "output" "output_length" ];

  meta = {
    description = "Brotli encoder and bounded decoder built from the brotli crate as WebAssembly";
    homepage = "https://github.com/dropbox/rust-brotli";
    license = [ lib.licenses.bsd3 lib.licenses.mit ];
    platforms = lib.platforms.all;
  };
}
