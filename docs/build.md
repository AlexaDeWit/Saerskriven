# Building the executables

How the CLI becomes one standalone executable per platform, what that
executable carries, and how to keep its pinned inputs current. Everything here
runs inside `nix develop` on Linux.

## Packaging the CLI

`pnpm nx compile @saerskriven/cli` builds and bundles the CLI, then compiles the
host executable. The `saer.js` bundle inlines every workspace package and
dependency and carries the version from the root manifest.
`--configuration=all` compiles every release target.

The `compile` target runs [`scripts/package-cli.sh`](../scripts/package-cli.sh),
which uses `deno compile` and can cross-compile every target from one Linux
machine. It runs the host executable four times: once for its version, once
to validate `test-data/saerskriven/two-diagrams.yaml`, and once each to render
that model to PDF and to PNG. Deno is a packaging tool only. Node stays the
development and test runtime.

The `test-compiled` target puts the CLI's scenario table through that
executable. It hashes the `compile` output, and Nx stores and restores
`dist/cli` even though git ignores the directory. CI builds the whole matrix on
every pull request and on every main, tag and manual run.

### What an executable carries

Anything not inlined into the bundle by esbuild, and not passed to
`deno compile --include <path>` in the packaging script, does not exist for a
user who has only the executable. The code reaches an included file at run
time through `import.meta.dirname`. `apps/cli/dist/assets` is that directory,
and it holds three kinds of file.

- **The Typst WebAssembly module**, copied out of the node_modules of
  `@saerskriven/render`, the package that declares the compiler, and pinned by
  the catalog and the lockfile.
- **The rasterizer module**, described [below](#the-svg-rasterizer).
- **Five Liberation faces and their licence**, copied out of the store path
  `SAERSKRIVEN_FONTS_DIR` names. Both dev shells export it from the pinned
  nixpkgs' `liberation_ttf`, so the fonts' provenance is the `nixpkgs` revision
  in `flake.lock`. Liberation Sans is metric-compatible with Arial, which the
  canvas stylesheet asks for, so a diagram embedded in a PDF keeps the layout
  the canvas measured.

None of these is committed. `apps/cli/src/pdf.ts` reads them back at run time
and hands the bytes to `@saerskriven/render/pdf`, which reads no file, so the
studio can compile the same document in a browser from bytes of its own.

Two checks stop a fontless or compiler-less executable. `fontIn` in
`apps/cli/esbuild.config.mts` stops a build whose `SAERSKRIVEN_FONTS_DIR` is
missing one of the five pinned faces, so a build outside the flake shell names
the missing variable. The packaging script's PDF render is the second: an
executable compiled without the Typst module, or with no `.ttf` beside it,
writes no PDF (`apps/cli/src/pdf.ts` refuses a fontless install rather than
typesetting a document with no text), so the `%PDF-` test fails.

## The SVG rasterizer

The `resvg-wasm` project builds a WebAssembly module out of the `resvg` crate,
which draws an SVG document into the bytes of a PNG. That crate and every crate
under it are pinned by [`nix/resvg-wasm/Cargo.lock`](../nix/resvg-wasm/Cargo.lock)
and its checksums, fetched before the build and compiled with no network, so
two builds of one commit write one module.

Nix keeps the compilation and nx owns the dependency: the project's one target
runs `nix build .#resvg-wasm` to a fixed out-link under `dist/resvg-wasm`, and
every target that carries the module depends on it, so nothing has to be built
first by hand:

```sh
pnpm nx build @saerskriven/studio   # builds the module on the way
pnpm nx test @saerskriven/render    # so does this, and pnpm check
```

The flake names the path in `SAERSKRIVEN_RESVG_WASM`, which
[`nix/resvg-wasm/project.json`](../nix/resvg-wasm/project.json) writes the module
to. The variable names where the module will be rather than a store path, so
it is the graph edge and not the variable that puts a file there, and a target
that carries the module without declaring the edge fails on its first build.
Declaring it is two lines: `dependsOn` on `resvg-wasm:build`, and that build's
output among the target's inputs.

`pnpm snapshots:update` runs Vitest outside nx, so it builds nothing on the
way. In a checkout with no `dist/resvg-wasm`, run `pnpm nx run resvg-wasm:build`
before updating the render snapshots.

No dev shell carries the module or the Rust toolchain that builds it, so
entering `nix develop` to work on the TypeScript pays for neither. A cold build
pays the Rust compile once, and then replays it until `flake.lock`, `flake.nix`
or `nix/resvg-wasm` changes. CI's Nix-store cache keeps the module and not the
toolchain: the out-link is a garbage-collection root for the 2 MiB module
alone, and `cache-nix-action` collects the store before it saves, so the Rust
build inputs leave the entry and it stays under the cache ceiling.
`build-test` is that cache prefix's one writer, and the `Rasterizer module` job
restores an entry that already holds the module's output path, so its build
validates that path rather than compiling the crate. A change under
`nix/resvg-wasm`, or a `flake.lock` bump that moves the Rust toolchain, is what
makes a job pay the compile.

`@saerskriven/render/resvg` takes the module and the faces as bytes from its
caller, as the `pdf` subpath takes the Typst module. `resvgWasmAsset` on the
`build-assets` subpath locates the module through `SAERSKRIVEN_RESVG_WASM`. The
rasterizer's spec skips on an unset or empty variable, which is what running
outside the flake shell looks like. Inside it the variable is always set, so a
module the build failed to write fails the spec on the missing file rather
than skipping it, which is why no CI job checks for that file first.

The CLI build copies the module into `apps/cli/dist/assets`, and the studio
build emits it as a hashed asset of the website. Both refuse a build that has
no module.

## The runtime inside an executable

About 33 MB of every executable is the denort runtime `deno compile` embeds.
It is not the compiler, so the flake's deno pin does not cover it, and deno
would fetch it per target from `dl.deno.land` at build time. These controls
replace that:

- **The runtimes are pinned by hash.** `flake.nix` holds one SHA-256 per
  target in `denortHashes` and assembles the five zips into the `DENO_DIR`
  layout deno reads before reaching for the network. The script refuses a
  target with no pin.
- **A compile has no network.** `scripts/package-cli.sh` runs every
  `deno compile` under `unshare -rn`, passes `--no-remote`, `--no-npm` and
  `--cached-only`, and refuses to run where no network namespace can be made.
  The workflow sets `DENO_NO_UPDATE_CHECK` and `DENO_NO_PROMPT`. A runtime
  that is not pinned fails the compile instead of becoming a download.
- **The output is a function of the staged tree's bytes, names, times and
  modes.** `deno compile` records every embedded file's name, modification
  time and executable bit, so the script stages the bundle as a fixed
  `saer.js` beside the assets, stamps every file to the epoch and mode 644 and
  every directory to mode 755, and compiles that. It compiles every target
  into two directories, staging the repeat tree with another time and mode on
  purpose, and fails unless the two are byte for byte the same, so a dropped
  stamp shows up on a pull request.
- **The inputs are printed.** The script's last lines are the bundle's
  SHA-256, then each staged font's and their licence's, then the `SHA256SUMS`
  it wrote for the executables, so a nixpkgs bump that redraws a glyph shows in
  a run's log.

One host property reaches the output: deno's metadata records
`vfs_case_sensitivity`, its probe of the filesystem it compiled on, which every
Linux checkout reports as `s`. A case-insensitive mount would change it.

`scripts/package-cli.sh` refuses to run on macOS or Windows, since a network
namespace is a Linux facility, and outside the flake shell, which sets the
pins. A Linux checkout, VM or container is enough to build every target.

### Bumping deno

The URL version is `pkgs.deno.version`, so a nixpkgs bump moves all five URLs
while the hashes stay behind, and the build fails on a hash mismatch rather
than pairing a runtime with a compiler of another version. Renovate does not
know about this fetch, so replace the hashes by hand:

```sh
version=$(nix develop --command deno eval 'console.log(Deno.version.deno)')
for target in x86_64-unknown-linux-gnu aarch64-unknown-linux-gnu \
              x86_64-apple-darwin aarch64-apple-darwin \
              x86_64-pc-windows-msvc; do
  url="https://dl.deno.land/release/v${version}/denort-${target}.zip"
  base32=$(nix-prefetch-url --quiet "$url")
  echo "${target} $(nix hash convert --hash-algo sha256 --to sri "$base32")"
done
```

Paste the five into `denortHashes`, then run
`nix develop --command pnpm nx compile @saerskriven/cli --configuration=all`
and confirm it compiles offline. A new target needs an entry there before the
script will build it. A deno bump can also change the payload format the Nix
package patches ([Nix](nix.md#linux-compatibility-and-execution-coverage)).

## Rebuilding a released executable

The executables are a function of the commit, so the same tag rebuilt on any
Linux machine inside the flake gives the SHA-256 the release page carries.
Anyone can run this:

```sh
git switch --detach "v<version>"
nix develop --command pnpm install --frozen-lockfile
nix develop --command pnpm nx compile @saerskriven/cli
```

The default shell is enough: `flake.nix` puts the denort pins and the font path
in both shells, and `.#ci` is the shell CI happens to enter. Compare the host
target's line with the release's `SHA256SUMS`. Every CI run prints the same
hashes, so a runner build and a local build can be compared from the logs.

A mismatch belongs to one step, and the hashes printed above the sums say
which. A bundle hash that already differs puts it in the esbuild build: the
checkout is not the tag, or the toolchain is not the flake's. A font hash that
differs puts it in the flake's nixpkgs revision. A matching bundle and matching
fonts under a differing executable puts it in `deno compile`: the denort pins
moved, or something environment-dependent has reached the output.
