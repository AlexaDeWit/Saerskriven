# The rasterizer's facts. A module file is data: flake.nix hands it to
# ../wasm-module.nix, the one builder, which holds the ban on unsafe Rust and
# says why each piece of the derivation is there. `.` is the export crate and
# `rasterizer` the logic crate.
{
  pname = "saerskriven-resvg-wasm";
  root = ./.;
  logic = "rasterizer";
  library = "saerskriven_resvg";
  upstream = "resvg";
  exports = [
    "input" "add_font" "render" "width" "height" "output" "output_length"
  ];
  description = "SVG to PNG rasterizer built from the resvg crate as WebAssembly";
  homepage = "https://github.com/linebender/resvg";
  licenses = [ "mpl20" "asl20" ];
}
