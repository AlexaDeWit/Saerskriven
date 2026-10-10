# The brotli codec's facts. A module file is data: flake.nix hands it to
# ../wasm-module.nix, the one builder, which holds the ban on unsafe Rust and
# says why each piece of the derivation is there. `.` is the export crate and
# `codec` the logic crate.
{
  pname = "saerskriven-brotli-wasm";
  root = ./.;
  logic = "codec";
  library = "saerskriven_brotli";
  upstream = "brotli";
  # The logic crate's direct dependencies, part of the ban on unsafe Rust
  # because their macros can expand to unsafe code the forbid does not see.
  dependencies = [ "brotli" "crc32fast" "ppmd-rust" ];
  exports = [ "input" "compress" "decompress" "compress_ppmd" "decompress_ppmd" "output" "output_length" ];
  description = "Brotli and experimental PPMd share-link codecs as WebAssembly";
  homepage = "https://github.com/dropbox/rust-brotli";
  licenses = [ "bsd3" "mit" "cc0" ];
}
