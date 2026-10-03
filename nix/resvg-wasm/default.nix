{ lib, callPackage }:

# The rasterizer, built by ../wasm-module.nix, which holds the ban on unsafe
# Rust and says why each piece of the derivation is there. `.` is the export
# crate and `rasterizer` the logic crate.
callPackage ../wasm-module.nix {
  pname = "saerskriven-resvg-wasm";
  root = ./.;
  logic = "rasterizer";
  library = "saerskriven_resvg";
  upstream = "resvg";
  exports = [
    "input" "add_font" "render" "width" "height" "output" "output_length"
  ];

  meta = {
    description = "SVG to PNG rasterizer built from the resvg crate as WebAssembly";
    homepage = "https://github.com/linebender/resvg";
    license = [ lib.licenses.mpl20 lib.licenses.asl20 ];
    platforms = lib.platforms.all;
  };
}
