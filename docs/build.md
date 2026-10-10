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
path. The same guarded module also exports `compress_ppmd()` and
`decompress_ppmd(maximum)` for the opt-in
[compact share-link proof of concept](share-link-poc.md). They share the
existing input and output buffers and use the locked Rust PPMd crate.

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
- **The packaging Node and the embedded Node are one version.** Node requires
  the binary that builds a single executable and the binary it injects into to
  be one version, so the flake takes the version in the four URLs from the
  `nodejs-slim_26` it packages with.
- **A build has no network.** The script runs every `node --build-sea`, and
  the signing of the macOS executable, under `unshare -rn`, and refuses to run
  where no network namespace can be made. A binary that is not pinned fails
  the build instead of becoming a download.
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
[permission model](https://nodejs.org/api/permissions.html) on.
[`scripts/sea-executable.sh`](../scripts/sea-executable.sh) holds the
arguments it starts with, and they say three things:

- File reads and file writes are granted, whole.
- Every other permission flag of the pinned Node is denied by name: the
  network, child processes, worker threads, native addons, WASI, FFI, the
  inspector, OpenSSL STORE loaders, and the mounting of a virtual file system.
- `execArgvExtension` is `none`, so Node reads neither `NODE_OPTIONS` nor a
  `--node-options` argument.

With the network denied Node refuses a connection, `fetch`, a name lookup, a
listening socket, a datagram socket and a Unix socket. WebAssembly needs no
grant, and neither does the environment.

The denials are by name because the absence of a grant is not enough. Node
reads four arguments in a command line before `saer` does:
`--experimental-config-file` and `--experimental-default-config-file`
wherever they stand, even after a `--`, and `--env-file` and
`--env-file-if-exists` up to a `--`. A configuration file may hold a
`permission` section, and Node applies it. Node parses the executable's own
arguments after that file, so a denial there wins over a grant in the file,
where a flag the arguments left unmentioned would stay granted.

The rest of what those four arguments do is Node's and not ours. A
configuration file's `test` and `watch` sections change nothing in an
executable, a `bench` section stops it, and the variables of an environment
file do not reach `saer`. A named file that is missing stops the command with
Node's own message and exit code 9, as
`saer --env-file=absent validate model.yaml` does (`--env-file-if-exists`
prints a line and goes on), and so does every command while
`NODE_REPL_EXTERNAL_MODULE` is set. Node leaves the arguments in the command
line, so `saer` then refuses them as arguments it does not know.

One variable is outside what the restriction claims. Node reads the OpenSSL
configuration that `OPENSSL_CONF` names when it starts, before the permission
model and outside it, and an engine entry in that file names a library for
OpenSSL to load into the process. That stands beside the dynamic loader's own
variables, such as `LD_PRELOAD`: whoever sets the environment of the person
running `saer` can already load code into it, and the restriction is a guard
rail against errors of our own implementation, which sets neither.

This is a second guard rail against errors of our own implementation, such as
a render path that came to fetch a file or to start a program. It is not a
defence against a compromised dependency or against hostile code inside the
executable. Node calls its permission model a "seat belt" for trusted code,
and its security policy says the model is designed "**not** to act as a
security boundary against intentional misuse or a compromised process"
([`SECURITY.md`](https://github.com/nodejs/node/blob/v26.11.0/SECURITY.md#permission-model-boundaries---permission)).
The bundle run under node carries no restriction at all.

The model also refuses a few calls whatever the grants: under it `fsync`,
`fdatasync`, `fchmod`, `fchown` and `futimes` throw `ERR_ACCESS_DENIED`, and
so does a write given the `flush` option, which is the likeliest way a writer
would come to one. The bundle calls none of them and passes no `flush`. A
writer that came to either would fail in the executable alone, where only the
compiled scenario table would show it.

`apps/cli/src/restriction.spec.ts` packages a probe with the same script, and
so under the same arguments, and holds each channel to its refusal. It runs
the probe as built, with every grant in `NODE_OPTIONS`, with every grant in a
`--node-options` argument, and with a configuration file that grants every
other permission flag of the packaging Node, named as the last argument, as
the first, after a `--`, and as the `node.config.json` of the working
directory.
It also sends a waiting probe `SIGUSR1`, which opens the inspector of a Node
that allows it, and requires no listener and no word on standard error. Every
attempt stays on the machine: a connection goes to a loopback listener the
spec holds, which must see none. The probe also has to read and write a file,
read an asset and run WebAssembly, so a probe that did not start cannot pass.
The spec runs in the `test-compiled` target and in no other.

A Node that adds a permission flag stops the build: the script compares the
flags `node --help` lists with the ones it grants or denies, and refuses to
package until each is one or the other. Node's main branch has `--allow-env`,
which 26.11 does not: under it a process starts without the environment
variables it was not granted.

### What a Linux executable needs

The Linux executables are dynamically linked, as the official Node binaries
are. The [README](../README.md#macos-and-linux) states what a system has to
provide, and it is the one statement of it. Its source is Node's
[`BUILDING.md`](https://github.com/nodejs/node/blob/v26.11.0/BUILDING.md#official-binary-platforms-and-toolchains),
which gives the floor of the official binaries and says that since Node 25
they need the libatomic runtime. To read what a built executable asks for:

```sh
readelf -d dist/cli/saer-<version>-x86_64-unknown-linux-gnu | grep NEEDED
objdump -T dist/cli/saer-<version>-x86_64-unknown-linux-gnu |
  grep -o 'GLIBC_[0-9.]*' | sort -V -u | tail -1
```

On Node 26.11.0 both Linux executables name `libatomic.so.1`, `libstdc++.so.6`,
`libgcc_s.so.1` and glibc's `libc`, `libm`, `libdl` and `libpthread`, and
reference no version above `GLIBC_2.28` and `GLIBCXX_3.4.21`, which is at or
under the floor Node states. A system that cannot provide them uses the
[Nix package](nix.md), which brings its own loader and libraries.

### Bumping Node

The flake names two Nodes. `nodejs_24` is the development and test runtime,
and nothing here moves it. `nodejs-slim_26` packages the executables, and the
version in the four URLs is its version, so a nixpkgs bump that moves Node 26
moves all four URLs while the hashes stay behind. From then on every
`nix develop` fails with a hash mismatch, because the binaries are an input of
every shell, until the four hashes are replaced. Renovate does not know about
this fetch, so replace them by hand, from the checksums the release publishes.
None of this needs the shell:

```sh
version="v$(nix eval --inputs-from . --raw nixpkgs#nodejs-slim_26.version)"
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
into `nodeRuntimePins` in `flake.nix`, each beside the target its file is
for. `nix develop` enters again once they match. Then run
`nix develop --command pnpm nx compile @saerskriven/cli --configuration=all`,
which packages every target offline, and
`nix develop --command pnpm nx test-compiled @saerskriven/cli`. A new target
needs an entry in `nodeRuntimePins` before the script will build it.

What a bump can change, and where to look:

- **The permission flags.** `scripts/sea-executable.sh` stops the build when
  the new Node has a flag it neither grants nor denies: add it to the
  denials, or grant it if `saer` loses what it gates, and add a row for it to
  the probe. A flag that takes a value, as the `--allow-env` on Node's main
  branch does, is granted with the value we mean or left out, never negated
  with `--no-`, and the build's comparison stops on it until the script lists
  it. Read the release notes of every Node in between for single executable
  applications and the permission model, which Node 26 still develops.
- **What a Linux executable needs.** Read it off the built executables
  [as above](#what-a-linux-executable-needs). "glibc 2.28" is written in
  `README.md`, in the message of `scripts/release/install.sh` and in the
  test of that message in `scripts/release/install.test.mts`.
- **The version in this page.** The two links into Node's repository above
  name `v26.11.0`, and so do the sentences that say what was measured on it.
- **The Web Storage globals** that [CODING.md](../CODING.md#build-targets)
  records for the runtime inside an executable.

A new Node major is a change of the attribute `flake.nix` names.

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
