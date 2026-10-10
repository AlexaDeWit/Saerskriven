# Building the executables

How the CLI becomes one standalone executable per platform, what that
executable carries, and how to keep its pinned inputs current. Everything here
runs inside `nix develop` on Linux.

## Packaging the CLI

`pnpm nx compile @saerskriven/cli` builds and bundles the CLI, then packages the
host executable. The `saer.js` bundle inlines every workspace package and
dependency and carries the version from the root manifest.
`--configuration=all` packages every release target.

The `compile` target runs [`scripts/package-cli.sh`](../scripts/package-cli.sh),
which builds each executable as a Node
[single executable application](https://nodejs.org/api/single-executable-applications.html)
and builds every target on one Linux machine: `x86_64-unknown-linux-gnu`,
`aarch64-unknown-linux-gnu`, `aarch64-apple-darwin` and
`x86_64-pc-windows-msvc`. It runs the host executable five times: once for its
version, once to validate `test-data/saerskriven/two-diagrams.yaml`, once each
to render that model to PDF and to PNG, and once to write it as a share link.
Node 26 packages an executable and is the runtime inside it. Node 24 stays the
development and test runtime.

The `test-compiled` target puts the CLI's scenario table through that
executable. It hashes the `compile` output, and Nx stores and restores
`dist/cli` even though git ignores the directory. CI builds the whole matrix on
every pull request and on every main, tag and manual run.

### What an executable carries

Anything not inlined into the bundle by esbuild, and not embedded by the
packaging script, does not exist for a user who has only the executable.
`apps/cli/dist/assets` is the directory the build gathers those files in, and
it holds four kinds of file.

- **The Typst WebAssembly module**, copied out of the node_modules of
  `@saerskriven/render`, the package that declares the compiler, and pinned by
  the catalog and the lockfile.
- **The rasterizer module**, described [below](#the-svg-rasterizer).
- **The brotli module**, described [below](#the-brotli-module), which
  `saer share` and the MCP server's `saer_share_link` compress a link with.
- **Five Liberation faces and their licence**, copied out of the store path
  `SAERSKRIVEN_FONTS_DIR` names. Every dev shell exports it from the pinned
  nixpkgs' `liberation_ttf`, so the fonts' provenance is the `nixpkgs` revision
  in `flake.lock`. Liberation Sans is metric-compatible with Arial, which the
  canvas stylesheet asks for, so a diagram embedded in a PDF keeps the layout
  the canvas measured.

None of these is committed. `apps/cli/src/pdf.ts` reads them back at run time
and hands the bytes to `@saerskriven/render/pdf`, which reads no file, so the
studio can compile the same document in a browser from bytes of its own.

Inside an executable the files are single executable assets, keyed
`assets/<name>`, and `apps/cli/src/assets.ts` reads them through `node:sea`,
where under node it reads the directory beside the bundle. A directory named
`assets` beside an installed executable is never read. Node has a second
route, a virtual file system that serves the same assets to `node:fs`. It is
not used: Node 26 marks it "Stability: 1.0 - Early development", and under the
permission model it needs a grant of its own, `--allow-fs-vfs`. The asset API
rests on the single executable feature alone, which Node 26 marks
"Stability: 1.1 - Active development".

Two checks stop a fontless or compiler-less executable. `fontIn` in
`apps/cli/esbuild.config.mts` stops a build whose `SAERSKRIVEN_FONTS_DIR` is
missing one of the five pinned faces, so a build outside the flake shell names
the missing variable. The packaging script's PDF render is the second: an
executable packaged without the Typst module, or with no `.ttf` beside it,
writes no PDF (`apps/cli/src/pdf.ts` refuses a fontless install rather than
typesetting a document with no text), so the `%PDF-` test fails. Its PNG
render and its share link stop an executable packaged without the rasterizer
or the brotli module the same way.

## The WebAssembly modules

Two Rust crates become WebAssembly modules in the flake: the `resvg-wasm`
project builds the [SVG rasterizer](#the-svg-rasterizer) and the
`brotli-wasm` project builds the [brotli module](#the-brotli-module). Each
crate and every crate under it are pinned by the module's `Cargo.lock` and its
checksums, fetched before the build and compiled with no network, so two builds
of one commit write one module.

Nix keeps the compilation and nx owns the dependency: each project's one target
runs `nix build` to a fixed out-link under `dist/`, and every target that
carries a module depends on that build, so nothing has to be built first by
hand:

```sh
pnpm nx run resvg-wasm:build          # one module alone
pnpm nx build @saerskriven/studio     # builds both on the way
pnpm nx test @saerskriven/render      # builds the rasterizer
```

The flake names each module's path in a variable, `SAERSKRIVEN_RESVG_WASM` and
`SAERSKRIVEN_BROTLI_WASM`, which the module's `project.json` under `nix/` writes
it to. The variable names where the module will be rather than a store path, so
it is the graph edge and not the variable that puts a file there, and a target
that carries a module without declaring the edge fails on its first build.
Declaring it is two lines: `dependsOn` on the module's build, and that build's
output among the target's inputs.

`pnpm snapshots:update` runs Vitest outside nx, so it builds nothing on the
way. In a checkout with no `dist/resvg-wasm`, run `pnpm nx run resvg-wasm:build`
before updating the render snapshots.

No dev shell carries a module or the Rust toolchain that builds it, so entering
`nix develop` to work on the TypeScript pays for neither. A cold build pays the
Rust compile once, and then replays it until `flake.lock`, `flake.nix`, the
module's directory under `nix/`, or the builder and scripts every module shares
change. CI's Nix-store cache keeps the modules and not the toolchain: each
out-link is a garbage-collection root for its module alone, and
`cache-nix-action` collects the store before it saves, so the Rust build inputs
leave the entry and it stays under the cache ceiling. `build-test` is that
cache prefix's one writer, and the `Rasterizer module` job restores an entry
that already holds the rasterizer's output path, so its build validates that
path rather than compiling the crate. A change under `nix/resvg-wasm` or to the
builder and scripts every module shares, or a `flake.lock` bump that moves the
Rust toolchain, is what makes a job pay the compile.

Both modules are built by [`nix/wasm-module.nix`](../nix/wasm-module.nix), under
the ban on unsafe Rust that [CODING.md](../CODING.md#rust-modules) states: a
logic crate that forbids `unsafe_code` and an export crate whose `src/lib.rs` is
the export table alone, checked before the compile and on the built module by
the two scripts the builder runs. Each module's `default.nix` is data that
`flake.nix` hands to the builder, and `flake.nix`, the builder, the two scripts
and the module files are the ban's trust root, where a change is a change to the
ban. The forbid does not see an `unsafe` block that a dependency's macro expands
to, so each module's file also lists its logic crate's direct dependencies, and
the guard refuses any other. Each module's `Cargo.lock` is trust root too: a
dependency bump can reach a re-exported macro that expands to unsafe code the
forbid does not see, so a lock change is reviewed as a change to the ban.

Rust owns one input buffer and one output buffer. The caller writes its bytes at
the address `input(length)` answers, runs one of the module's calls, and copies
the answer from the address and length `output()` and `output_length()` answer,
so no address the caller holds is read in Rust. A call that writes the output
answers a status, and 0 means the output holds the answer. Any call may grow the
module's memory, so the caller makes each view of it after the call that
answered its address. An allocation the module cannot make aborts it, which the
caller sees as a trap.

Every call but a getter empties the output buffer before it does anything else,
so after a call that trapped the getters answer nothing an earlier call wrote.
The getters are `output()` and `output_length()`, and the rasterizer's `width()`
and `height()`, whose size is reset to 0 with the buffer. Emptying frees the
buffer's memory and does not wipe it, so the rule covers what the getters answer
and not what the module's memory still holds.

[`@saerskriven/wasm`](../packages/wasm/README.md) drives both modules, compiles
each module once per byte array and runs each call on its own instance, and
`flakeModuleAsset` on its `build-assets` subpath locates a module through its
variable. A suite that runs a module skips where the variable is unset or
empty, which is what running outside the flake shell looks like. Inside it the
variable is always set, so a module the build failed to write fails the suite
on the missing file rather than skipping it, which is why no CI job checks for
that file first.

### The SVG rasterizer

The `resvg-wasm` project builds the module out of the `resvg` crate
([`linebender/resvg`](https://github.com/linebender/resvg)), pinned by
[`nix/resvg-wasm/Cargo.lock`](../nix/resvg-wasm/Cargo.lock), which draws an
SVG document into the bytes of a PNG. Its logic crate is
[`nix/resvg-wasm/rasterizer`](../nix/resvg-wasm/rasterizer), and its export
table [`src/lib.rs`](../nix/resvg-wasm/src/lib.rs) names its calls: `add_font()`
takes the input buffer as a font, `render(long_edge)` draws the SVG in the input
buffer into the output buffer, and `width()` and `height()` answer the PNG's
size. `SAERSKRIVEN_RESVG_WASM` names its path.

`@saerskriven/render/resvg` takes the module and the faces as bytes from its
caller, as the `pdf` subpath takes the Typst module, and `resvgWasmAsset` on
the `@saerskriven/render/build-assets` subpath locates it. The CLI build copies
the module into `apps/cli/dist/assets`, and the studio build emits it as a
hashed asset of the website. Both refuse a build that has no module.

### The brotli module

The `brotli-wasm` project builds the module out of the `brotli` crate
([`dropbox/rust-brotli`](https://github.com/dropbox/rust-brotli)), pinned by
[`nix/brotli-wasm/Cargo.lock`](../nix/brotli-wasm/Cargo.lock), which share
links compress with (#604). It holds an encoder, at quality 11 with no custom
dictionary so any standard brotli decoder reads its output, and a decoder that
refuses a stream at the first byte past a maximum the caller names. The
encoder's window is the smallest that covers the input, capped at 24 bits,
because its memory follows the window and a larger one shortens no link. Its
logic crate is [`nix/brotli-wasm/codec`](../nix/brotli-wasm/codec), and its
export table [`src/lib.rs`](../nix/brotli-wasm/src/lib.rs) names its calls,
`compress()` and `decompress(maximum)`. `SAERSKRIVEN_BROTLI_WASM` names its
path.

`@saerskriven/formats/brotli` takes the module as bytes from its caller, and
`brotliWasmAsset` on the `@saerskriven/formats/build-assets` subpath locates
it. The studio's build resolves `virtual:saerskriven-brotli-wasm?url` to the
module as a hashed asset, so a page can fetch it only when it needs it. The CLI
build copies the module into `apps/cli/dist/assets`, as it copies the
rasterizer, and both refuse a build that has no module.

## The runtime inside an executable

Every executable is an official Node binary with the bundle and the assets
injected into it by `node --build-sea`.
[`scripts/sea-executable.sh`](../scripts/sea-executable.sh) builds one, and it
is the one home of the configuration every executable ships under. These
controls decide what goes in:

- **The binaries are pinned by hash.** `flake.nix` holds one SHA-256 per
  target in `nodeRuntimePins`, each the hash that the Node release publishes
  in its signed `SHASUMS256.txt`. It fetches the four from `nodejs.org` and
  takes `bin/node` alone out of each archive. The script refuses a target with
  no pin.
- **The packaging Node and the embedded Node are one version.** `--build-sea`
  injects only into a binary of its own version, so the flake takes the
  version in the four URLs from the `nodejs-slim_26` it packages with.
- **A build has no network.** The script runs every `node --build-sea` under
  `unshare -rn` and refuses to run where no network namespace can be made. A
  binary that is not pinned fails the build instead of becoming a download.
- **The output is a function of the staged files' bytes and names.** The
  configuration names the bundle and the assets by paths relative to the
  staged tree, in sorted order, because an absolute path to the bundle would
  be embedded. `scripts/package-cli.sh` builds every target from two staged
  trees whose times and modes differ, and fails unless the two executables are
  byte for byte the same.
- **The macOS executable is signed ad hoc, on Linux.** `--build-sea` removes
  the Mach-O signature and macOS on Apple silicon runs no unsigned code, so
  the script signs with `rcodesign`, with no certificate and the identifier
  `saer`. The signature is among the compared bytes. It is not a Developer ID
  signature, and nothing is notarised.
- **The inputs are printed.** The packaging script's last lines are the
  bundle's SHA-256, then each staged font's, their licence's, the rasterizer's
  and the brotli module's, then the `SHA256SUMS` it wrote for the executables,
  so a nixpkgs bump that redraws a glyph shows in a run's log.

Each Linux build prints one line from the library Node injects with,
`LIEF doesn't know the section name for note: 'UNKNOWN'`. The executable it
writes runs.

`scripts/package-cli.sh` refuses to run on macOS or Windows, since a network
namespace is a Linux facility, and outside the flake shell, which sets the
pins. A Linux checkout, VM or container is enough to build every target.

Three of the four executables run in CI, each on a runner of its own kind
through the [installer smoke](release.md#the-procedure): Linux x64, Linux
arm64 and macOS arm64. Nothing runs the Windows executable.

### What an executable may do

Every executable starts Node with its
[permission model](https://nodejs.org/api/permissions.html) on and two grants,
file reads and file writes:

```
--permission --allow-fs-read=* --allow-fs-write=*
```

With no other grant Node refuses the network (a connection, `fetch`, a name
lookup, a listening socket, a datagram socket, a Unix socket), child
processes, worker threads, native addons, WASI, FFI and the inspector.
WebAssembly needs no grant, and neither does the environment. The
configuration sets `execArgvExtension` to `none`, so neither `NODE_OPTIONS`
nor a `--node-options` argument adds a grant, and an argument such as
`--allow-net` reaches `saer` as one of its own and is refused as an unknown
option.

This is a second guard rail against errors of our own implementation, such as
a render path that came to fetch a file or to start a program. It is not a
defence against a compromised dependency or against hostile code inside the
executable. Node calls its permission model a "seat belt" for trusted code,
and its security policy says the model is designed "**not** to act as a
security boundary against intentional misuse or a compromised process"
([`SECURITY.md`](https://github.com/nodejs/node/blob/v26.11.0/SECURITY.md#permission-model-boundaries---permission)).
The bundle run under node carries no restriction at all.

`apps/cli/src/restriction.spec.ts` packages a probe with the same script, and
so under the same configuration, and holds each of those channels to its
refusal: as built, with every grant in `NODE_OPTIONS`, and with every grant as
an argument. Every attempt stays on the machine: a connection goes to a
loopback listener the spec holds, which must see none. The probe also has to
read and write a file, read an asset and run WebAssembly, so a probe that did
not start cannot pass. It runs with the compiled scenario table, in the
`test-compiled` target.

A later Node that gates more behind the model refuses it here until `execArgv`
grants it. Node's main branch has `--allow-env`, which 26.11 does not: under
it a process starts without the environment variables it was not granted.

### What a Linux executable needs

The Linux executables are dynamically linked, as the official Node binaries
are, and the [README](../README.md#macos-and-linux) states what a system has
to provide: glibc 2.28 or newer, libstdc++ and libatomic. Node's
[`BUILDING.md`](https://github.com/nodejs/node/blob/v26.11.0/BUILDING.md#official-binary-platforms-and-toolchains)
gives the floor of its binaries as glibc 2.28 and libstdc++ 6.0.25, and says
that since Node 25 they need the libatomic runtime. To read what a built
executable asks for:

```sh
readelf -d dist/cli/saer-<version>-x86_64-unknown-linux-gnu | grep NEEDED
objdump -T dist/cli/saer-<version>-x86_64-unknown-linux-gnu |
  grep -o 'GLIBC_[0-9.]*' | sort -V -u | tail -1
```

On Node 26.11.0 both Linux executables name `libatomic.so.1`, `libstdc++.so.6`,
`libgcc_s.so.1` and glibc's `libc`, `libm`, `libdl` and `libpthread`, and
reference no version above `GLIBC_2.28` and `GLIBCXX_3.4.21`. A system that
cannot provide them uses the [Nix package](nix.md), which brings its own
loader and libraries.

### Bumping Node

The flake names two Nodes. `nodejs_24` is the development and test runtime,
and nothing here moves it. `nodejs-slim_26` packages the executables, and the
version in the four URLs is its version, so a nixpkgs bump that moves Node 26
moves all four URLs while the hashes stay behind, and the build fails on a
hash mismatch rather than injecting into a binary of another version.
Renovate does not know about this fetch, so replace the hashes by hand, from
the checksums the release publishes:

```sh
version=$(nix develop --command sh -c '"$SAERSKRIVEN_SEA_NODE" --version')
curl -q --fail --silent --show-error --location --remote-name \
  "https://nodejs.org/dist/${version}/SHASUMS256.txt"
for file in "node-${version}-linux-x64.tar.xz" \
            "node-${version}-linux-arm64.tar.xz" \
            "node-${version}-darwin-arm64.tar.xz" win-x64/node.exe; do
  hex=$(awk -v file="$file" '$2 == file { print $1 }' SHASUMS256.txt)
  echo "${file} $(nix hash convert --hash-algo sha256 --to sri "$hex")"
done
```

`SHASUMS256.txt.sig` beside that file is a release key's signature over it,
which Node's README says how to
[verify](https://github.com/nodejs/node#verifying-binaries). Paste the four
into `nodeRuntimePins`, then run
`nix develop --command pnpm nx compile @saerskriven/cli --configuration=all`
and `nix develop --command pnpm nx test-compiled @saerskriven/cli`, and
confirm the first packages offline. A new target needs an entry there before
the script will build it.

Read the release notes of every Node in between for single executable
applications and the permission model, which Node 26 still develops: a new
permission scope needs a grant in `scripts/sea-executable.sh` or `saer` loses
what it gates, and the probe spec names each refusal by its error code. A
bump can also change [what a Linux executable needs](#what-a-linux-executable-needs)
and the Web Storage globals [CODING.md](../CODING.md#build-targets) records. A
new Node major is a change of the attribute `flake.nix` names.

## Rebuilding a released executable

The executables are a function of the commit, so the same tag rebuilt on any
Linux machine inside the flake gives the SHA-256 the release page carries.
Anyone can run this:

```sh
git switch --detach "v<version>"
nix develop --command pnpm install --frozen-lockfile
nix develop --command pnpm nx compile @saerskriven/cli
```

The default shell is enough: `flake.nix` puts the Node pins and the font path
in every shell, and `.#ci` is the shell CI happens to enter. Compare the host
target's line with the release's `SHA256SUMS`. Every CI run prints the same
hashes, so a runner build and a local build can be compared from the logs.

A mismatch belongs to one step, and the hashes printed above the sums say
which. A bundle hash that already differs puts it in the esbuild build: the
checkout is not the tag, or the toolchain is not the flake's. A font hash that
differs puts it in the flake's nixpkgs revision. A matching bundle and matching
fonts under a differing executable puts it in the packaging: the Node pins
moved, or something environment-dependent has reached the output.
