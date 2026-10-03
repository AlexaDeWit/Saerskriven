# @saerskriven/wasm

The TypeScript side of the WebAssembly boundary every flake-built Rust module
shares, as [Building the executables](../../docs/build.md#the-webassembly-modules)
describes it. It imports no internal package, so `@saerskriven/formats`, which
drives the brotli module, and `@saerskriven/render`, which drives the
rasterizer, share one copy while neither may import the other.

## The driver

The main entry ([`boundary.ts`](src/lib/boundary.ts)) holds what a module's
driver does that does not depend on the module:

- `instantiated(wasm, calls, absent)` compiles the bytes once per array,
  through `promisePerBytes`, and answers a new instance whose exports hold the
  boundary's calls and every name in `calls`, or the sentence it failed with.
- `called(module, bytes, call)` writes the bytes into the input buffer and
  answers what the call returns. `answered` does the same and copies the
  output buffer beside it.
- `written` is the status a call answers when the output buffer holds what it
  wrote, and `isUnsigned` and `mostUnsigned` bound a call's 32-bit parameter.

A failure on this side is a sentence on the left of an `Either`: a module that
does not compile or start, one missing a call, one that trapped, and one that
answered an address past its memory. Each driver turns it into its own tagged
failure, as `BrotliFailure.Unusable` and `ResvgFailure.Unusable` do.

`promisePerBytes` is the compile cache on its own: one promise per byte buffer,
keyed by identity, with a rejected promise dropped so the next call starts
again. `@saerskriven/render/pdf` holds the Typst compiler's start in it.

## Locating a module

`flakeModuleAsset(module, refuse)`, on the Node-only `build-assets` subpath
([`build-assets.ts`](src/build-assets.ts)), answers the path a module's
variable names, or calls `refuse` with a sentence naming the `nix build` that
writes it. `resvgWasmAsset` and `brotliWasmAsset` name their module's
variable, flake output and file through it. The CLI's build and the studio's
Vite configuration load this file as source, through loaders that resolve no
relative import, so it imports none.

## Fixtures

The `fixtures` subpath holds `stop`, the refusal a spec hands a locator,
`unbuilt` and `builtModule`, which skip a suite outside the flake shell and
read a module once per suite, and `moduleWhoseEveryCall`, a hand-assembled
module whose every call runs one body, with bodies that trap, answer an
address past memory, or grow memory by a page.
