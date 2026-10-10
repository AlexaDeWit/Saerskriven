# Using the released CLI from Nix

`packages.${system}.saerskriven` installs `bin/saer` and the compatibility link
`bin/saerskriven -> saer` from the release pinned in
[`nix/release.json`](../nix/release.json). Each asset has a versioned URL and a
committed SHA-256 hash. The pin records the published binary name, so older
releases still use their original asset URLs. Evaluation reads only local Nix
and JSON files. Building fetches the selected asset if the Nix store does not
hold it. Shell entry never resolves Latest or downloads a checksum file.

The package carries the CLI runtime, PDF compiler, and fonts. It needs no
Saerskriven checkout or separate Node, browser, or Typst installation.
The CLI version follows the release pin, not the source checkout's workspace
version.

## Downstream flakes

A downstream flake adds Saerskriven as an input and puts `pkgs.saerskriven` in
its shells through the overlay. This minimal example is the shape
[Écluse](https://github.com/AlexaDeWit/Ecluse) uses, with the downstream
project's nixpkgs for both its shells and the CLI:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    saerskriven.url = "github:AlexaDeWit/Saerskriven";
    saerskriven.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { nixpkgs, saerskriven, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
        overlays = [ saerskriven.overlays.default ];
      };
      shell = pkgs.mkShell { packages = [ pkgs.saerskriven ]; };
    in {
      packages.${system}.saerskriven = pkgs.saerskriven;
      devShells.${system} = { default = shell; ci = shell; };
    };
}
```

Run `nix flake lock` once and commit `flake.lock`. It locks the Saerskriven
source revision as well as nixpkgs. Lock a revision that carries the package:
the `v0.1.0` tag predates it.

```sh
nix build .#saerskriven
nix develop --command saer --version
nix develop .#ci --command saer validate threat-model.yaml
```

The overlay calls [`nix/package.nix`](../nix/package.nix) with the caller's
`pkgs`. A caller without overlays can use
`pkgs.callPackage "${saerskriven}/nix/package.nix" { }`.
The direct `saerskriven.packages.${system}.saerskriven` output uses the flake's
nixpkgs input, including any downstream `follows` relationship.
Through the overlay or `callPackage`, an unsupported system fails with the
supported systems listed. The flake's own `packages` holds no `saerskriven`
for one.

To move to a later release, update the input lock in its own reviewed change:

```sh
nix flake update saerskriven
nix develop --command saer --version
nix develop .#ci --command saer validate threat-model.yaml
```

Review the lock diff and exercise the rendering commands the project uses
before merging that update.

## Linux compatibility and execution coverage

A Linux executable built on Node asks the system for glibc's loader and
libraries and for GCC's `libstdc++`, `libatomic` and `libgcc_s`
([what a Linux executable needs](build.md#what-a-linux-executable-needs)). The
package answers all of them from the caller's nixpkgs: it records that loader, and a
run path to those libraries, in the executable. It does not rely on NixOS's
`nix-ld`, `/lib64`, or host library paths. The package check below runs it in
a sandbox that holds no host loader and no host library, so this is the route
for a system that cannot provide them.

An executable built on Node holds its payload in an ELF note, and the package
patches it whole with `patchelf`. It disables later fixup so stripping does not
change the payload. The macOS package copies the release bytes without changing its
Mach-O signature.

| Nix system       | Release hashes and provenance | Execution checks                                     |
| ---------------- | ----------------------------- | ---------------------------------------------------- |
| `x86_64-linux`   | Verified                      | Nix sandbox locally and in the required CI build job |
| `aarch64-linux`  | Verified                      | Nix sandbox in the required native CI job            |
| `aarch64-darwin` | Verified                      | Nix package check in the required native CI job      |

`x86_64-darwin` has no package, because no executable is released for an Intel
Mac after v0.8.3. A flake input locked to a revision from before that still
provides the release it pinned.

The pin is the last release and never the tree, so the CI build job also runs
the check on the Linux x64 executable it has just built: the package is proven
on what the next release will hold before that release exists.
[`nix/built-check.nix`](../nix/built-check.nix) is that check, and its header
gives the command for a local build.

```sh
nix build --no-link --print-build-logs .#checks.x86_64-linux.saerskriven
nix flake check --all-systems --no-build
```

Substitute the native system in the first command. On Linux, use a Nix daemon
with `sandbox = true`. The sandbox exposes only declared build inputs and
has no external network route. The check runs the installed package from a
scratch directory, validates the committed v0.2.1 model file, and renders
Markdown, SVG, and PDF. It checks PDF text and embedded Liberation fonts with
Poppler. No external Node, browser, or Typst executable is on the check's
PATH.
Poppler belongs to the check, not the installed CLI's runtime closure.

## Updating the release pin

The release build must finish publication and attestation before its hashes
can be pinned. Keep the previous pin during version preparation and tag CI.
After publication, run this command from a Saerskriven checkout:

```sh
RELEASE_VERSION=v<version> nix develop --command pnpm nx run release-tools:update-nix
```

Set `RELEASE_VERSION` to the explicit stable version. Authenticate the GitHub CLI
before running it. The updater resolves that annotated tag's source commit,
selects a complete `saer` asset set or a legacy `saerskriven` set for the
existing target map, downloads each asset, and verifies its
attestation against this repository, `ci.yml`, the tag, and the source commit.
It computes SHA-256 from each verified asset's bytes. It replaces
`nix/release.json` only after every download and verification succeeds.
It does not execute downloaded binaries or change the workspace version.

Run the package checks above, review the version and hashes, and open a PR
for the packaging update. CI runs the package check on each supported native
system. Record each target actually executed, and keep untested targets marked
as such.
Do not move the signed release tag. The later packaging commit references
already published assets, so its CI has no dependency on an unpublished
release. No automated step commits, pushes, or merges the update.
