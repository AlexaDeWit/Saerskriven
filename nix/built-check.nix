# nix/check.nix on an executable that is not released yet, in place of the
# one nix/release.json pins. It reads a path outside the flake, so it needs
# --impure:
#
#   nix build --impure --no-link --file nix/built-check.nix \
#     --argstr executable "$PWD/dist/cli/saer-<version>-<target>" \
#     --argstr version <version>
{ executable, version }:

let
  lock = builtins.fromJSON (builtins.readFile ../flake.lock);
  pkgs = import (builtins.fetchTree lock.nodes.nixpkgs.locked) {
    system = builtins.currentSystem;
    config = { };
    overlays = [ ];
  };
  saerskriven = (pkgs.callPackage ./package.nix { }).overrideAttrs (_: {
    inherit version;
    src = /. + executable;
  });
in pkgs.callPackage ./check.nix { inherit saerskriven; }
