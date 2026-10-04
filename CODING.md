# Coding guidelines

The coding guidelines for Saerskriven, binding for humans and agents alike.
These are requirements, not suggestions.

## Error handling

Fallible APIs return Effect's `Either`, with a package-owned tagged
failure on the error channel: an Effect `Data.taggedEnum` discriminated
on `_tag`, readonly, and serializing to its plain tagged shape. Throwing
is not an error channel in this project's TypeScript. `parseModel`
follows the same rule: zod stays behind the parse boundary, and its
issues surface as plain data on the failure.

A fallible function's own parameter and return types carry no zod type,
and its failure carries plain data. A type that holds a schema as a member,
or is parameterized by one, is not a fallible signature.

A failure travels to its app's outermost boundary rather than being
handled early, and that boundary differs per app: `apps/cli/src/outcome.ts`
and `runCli` in the CLI, the refused tool result `renderWriteFailure`
writes in the MCP server, and the notice on screen in the studio.

A resource read and a prompt have no refused result in the MCP protocol, so
the MCP server has a second boundary: the resource-read and prompt handlers
in `packages/mcp/src/lib/server.ts` turn the failure they are handed into the
protocol error the SDK contract requires, and they are the only place in the
server that throws. The functions they call still return `Either`.

One other function throws on purpose. `svgNumber` in
`packages/canvas/src/lib/numbers.ts` raises a `RangeError` for a number that
is not finite, which no schema admits and only arithmetic produces. A render
cannot hand React a failure as a value, so the throw ends at each app's
outermost boundary: the studio's error boundary, `runCli`, and the MCP SDK's
dispatch around the server's handlers, which answers with an error result.

An operation with no value to return is typed `Either<void, E>`, never a
bare `void`. Narrowing such a parameter to `void` is not the simplification
it looks like: TypeScript accepts a function returning anything where a
`void`-returning function is expected, so every callback already passed in
still compiles, and the function taking the callback then drops the
failure and reports success. `throughTemporary` in
`packages/mcp/src/lib/write.ts` is the case in this tree: both callers refuse
from inside its `commit` callback, and with the parameter narrowed
`tsc --build` reports nothing while the write answers with a fresh revision
for a file it never replaced.

## Schema-first typing

Strict typing everywhere, schema-first. Zod schemas are the source of
truth, TypeScript types are inferred from them, and unions are
well-bounded. No hand-written types beside schemas, no unbounded strings
where a union is knowable.

No recursive schema whose depth the input decides rather than the schema:
a file names the depth, and a walk that follows it runs out of stack inside
a function typed as returning a result union. Every path that reads foreign
text is bounded against the numbers `@saerskriven/formats` exports as
`readLimits`: its size before it is parsed, its aliases as it is parsed, and
how deeply it nests once it has been. A text past a bound comes back as a
failure rather than throwing.

## Zod composition

Shared object fields are expressed with zod's own composition: a base
`z.object` extended per variant with `.extend()`. Never spread raw field
maps into schema literals.

`z.object` is the default for every schema, including the ones whose shape
Saerskriven owns: demanding about what it declares, and dropping what it does
not. `strictObject` is not used. Refusing a whole payload over one unknown
key is only safe with complete control of the data pipeline, which no
reader here has, and a file gains a field the first time another tool or a
later format version adds one. `looseObject` would carry along data that
nothing describes. Preservation rests on a wire schema declaring everything
its format carries, not on that tolerance, and the codec contract in
`packages/formats` requires a read to report a dropped key as a divergence,
so a strip is never silent and an incomplete schema shows up.

## Comments

Comments in TypeScript source are TSDoc on exports only, a simple summary
of the non-obvious. Config files (workflows, the flake, tool config like
`playwright.config.ts`) keep their constraint comments.

## Tests

Tests pin this project's decisions and regressions in broad strokes. They
do not re-verify what a dependency's own test suite or the type-checker
already guarantees.

A test is given ten seconds, set once in `vitest.shared.mts` for
`testTimeout` and `hookTimeout`, because the maintainer's machine and
GitHub's shared runners both run these suites under contention. That is the
ceiling for the root value: a spec needing longer declares its own at the
narrowest scope that needs it, with the reason beside it, as the CLI's PDF
compiles do.

The fixture helpers every suite shares live on the `@saerskriven/model/fixtures`
subpath, those for a suite that runs a flake-built WebAssembly module on
`@saerskriven/wasm/fixtures`, the built brotli module on
`@saerskriven/formats/fixtures`, and the mouse and touch events a jsdom suite
presses a mounted canvas with on `@saerskriven/canvas/fixtures`. Only a spec,
a test, or a fixture module imports a fixture helper. A fixtures subpath
resolves to source, so every project that
depends on its package reaches it, and nothing structural stops a downstream
production module: the typecheck resolves it like any other entry point and the
layer matrix reasons about projects rather than entry points, so a studio bundle
carrying a fixture-derived value passes both. A relative import of a package's
own fixtures module compiles too, since an import pulls in a module the lib
tsconfig excludes. The `no-restricted-imports` override in `.oxlintrc.json`
refuses both forms from every file but a spec, a test, or a fixture module.

A browser API that jsdom leaves out, and that the specs of more than one
project reach, is stubbed in one setup module, which its package exports as a
subpath and each of those projects names in its own `setupFiles`.
`@saerskriven/canvas/test-setup` stubs `ResizeObserver`: the canvas project
loads it by its own path, and the studio by the subpath, ahead of the studio's
own setup module. Only test configuration loads a setup subpath. The lint
refuses a production module that imports one for its side effect, as it refuses
any import that binds nothing, and nothing refuses one that imports it
dynamically.

## Prose register

Canadian English, no em- or en-dashes, no filler adjectives.

## Dependencies and versions

Single version policy: external dependency versions live only in the
`pnpm-workspace.yaml` catalog. Leaf manifests use `catalog:` and
`workspace:*` references.

A package the code imports is declared in the importing package's own
manifest, test-only ones under `devDependencies`. Never reach a library
through another package's re-export, or rely on it resolving transitively:
the version tested against is then someone else's to change.

The root manifest is a leaf under that rule too, and declares the workspace's
own tooling in four groups: the tools a root script or a target's command
runs, the nx plugins and executors `nx.json` names, what the root configs and
operator scripts import by name, and a tool's optional peers, held at the root
so their versions are this workspace's to pin rather than that tool's.
`tslib` sits outside all four, because `tsconfig.base.json` sets
`importHelpers` and emitted code imports it. A package a project renders or
tests with, React and Playwright among them, belongs to that project's
manifest, so no project resolves it through the root.

A binary Saerskriven did not author is a toolchain input rather than a file the
tree carries, so it comes from the flake or from the lockfile and its
provenance is that pin, and a build outside the flake fails naming the missing
input ([Building the executables](docs/build.md) lists what the CLI carries). Text a spec reads is a
different thing: the vendored Threat Dragon schema under
`test-data/threat-dragon/schema/` is a fixture, versioned with the tests that
read it and readable in a diff, so it stays committed with its provenance
beside it.

## Build targets

Targets are root-defined: nx plugins and `targetDefaults` own task
configuration. A leaf project opts in with a config file or an
executor-only marker, and deviations need a stated reason.

Nx replays a cached task result when the hash of its declared inputs is
unchanged. The default inputs are the project's own files and the Node
version. A task that reads a root file adds it through a target-specific
named input. Tests add the shared Vitest configuration. Each consumer adds
the committed fixtures it reads. Builds add only the configuration they run.

Cached tests only read committed snapshots. `pnpm snapshots:update <project>`
runs Vitest directly for one producer when snapshots must change. Normal test
targets do not run another project's tests.

Files a task produces are restored only when listed in its `outputs`. A task
that consumes another task's output declares both `dependsOn` and a
`dependentTasksOutputFiles` input. Four cases in this tree: the CLI's
`compile` stores `dist/cli` and its `test-compiled` hashes that executable
before it runs it, the CLI's `test` hashes the whole build output rather than
only its JavaScript, because the fonts and modules beside the bundle decide
what a render writes, the `resvg-wasm` build stores the rasterizer module
that the CLI's build, the studio's build and test, and `@saerskriven/render`'s
test each hash, and the `brotli-wasm` build stores the brotli module that the
CLI's build, the studio's build and test, and the tests of
`@saerskriven/formats` and `@saerskriven/mcp` each hash.

A leaf target that extends a `targetDefaults` or plugin-inferred array opens it
with the spread token `"..."`. Without it the leaf array replaces the default,
and every input or dependency the leaf does not restate is lost.

A target that empties its output directory owns that directory alone. The
studio's vite build empties `dist/` on every run and nothing orders it
against the typecheck, so the typecheck emits its declarations under
`out-tsc/`. Sharing the directory leaves a declaration deleted under a build
info file that records it as written, which the next `tsc --build` reports
as TS6305.

`@types/node` declares the Web Storage globals unconditionally, so
`localStorage` and `sessionStorage` type-check in both of the CLI's
programs, and the build program's `lib.webworker` also admits
`importScripts`. Node, the CLI's development and test runtime, leaves all
three undefined. The deno-compiled executable defines the Web Storage pair
([Building the executables](docs/build.md) covers the split), but no
runtime's main thread defines the worker-only `importScripts`. A
`no-restricted-globals` override in `.oxlintrc.json` refuses all three in
`apps/cli/**`, where the type program cannot.

## Rust modules

Saerskriven's Rust holds no `unsafe` code (owner rulings, 2026-10-02). Every
WebAssembly module under `nix/` is two crates, which
[`nix/wasm-module.nix`](nix/wasm-module.nix) builds:

- The logic crate holds the module's code and the buffers it shares with the
  caller. The root of its lib target opens with `#![forbid(unsafe_code)]`,
  which rustc applies to every module and included file of the crate and which
  no attribute, and no lint level a manifest passes, can lower. The forbid
  does not see an `unsafe` block that a dependency's macro expands to, so the
  logic crate's direct dependencies are part of the ban: its module file lists
  them, and adding one is a change to that file.
- The export crate's `src/lib.rs` is the export table alone: functions under
  `#[unsafe(no_mangle)]` whose body is one call to the logic crate's boundary
  function of the same name, passing the parameters in order. Rust owns the
  buffers and answers their addresses, so no address the caller holds is read
  in Rust.

The export table's `#![allow(unsafe_code)]` is the ban's one exception,
owner-approved on 2026-10-02. rustc forces it: `no_mangle` is an unsafe
attribute that the `unsafe_code` lint flags, so a crate that forbids the lint
can export no function a host could call.

The builder runs two scripts on every module:

- [`nix/unsafe-ban.sh`](nix/unsafe-ban.sh) runs before the compile. It reads
  the crates as Cargo resolves them, through `cargo metadata`, and refuses the
  build unless:
  - the export crate and the logic crate are the only local packages in the
    graph, and every other package comes from the crates.io registry, so no
    patch, replacement, path or git dependency brings in other code
  - the logic crate builds one target, a lib whose root is its `src/lib.rs`,
    and depends on registry crates alone, whose names, of every kind, are
    exactly those its module file lists
  - the export crate builds one target, a cdylib whose root is its
    `src/lib.rs`, and depends on the logic crate alone
  - neither crate has a build script
  - the logic crate's root, at the path the metadata reports, opens with the
    forbid after its `//!` header
  - the export crate's `src` holds `lib.rs` alone, and every line of it is a
    `//!` line, a blank line, the allowance, the one `use` of the logic crate's
    boundary, or a line of an export in that shape, whose parameters are 32-
    or 64-bit integers or floats, which a WebAssembly caller cannot pass out
    of range
  - no resolved dependency feature is named `unsafe` or `ffi-api`, read from
    `cargo tree -e features` in the sandbox
  - no `RUSTFLAGS`, `NIX_RUSTFLAGS` or rustc wrapper variable is set, and no
    Cargo configuration on Cargo's search path caps lints, forces a warning or
    wraps rustc
- [`nix/wasm-surface.sh`](nix/wasm-surface.sh) runs on the built module and
  refuses it unless it imports nothing and exports exactly `memory`, the calls
  its module file names, and the linker globals `__data_end` and
  `__heap_base`.

A manifest's own lint levels are not checked: `cargo metadata` does not report
them, and the forbid at the crate root is the rule rustc enforces.

A module's file (`nix/resvg-wasm/default.nix`, `nix/brotli-wasm/default.nix`) is
data: its crates, the logic crate's direct dependencies, its exports and its
output's name, which `flake.nix` hands to the builder, so no module file builds
a derivation or drops one of the builder's phases. `flake.nix`,
`nix/wasm-module.nix`, the two scripts and the module files are the ban's trust
root. A change to any of them is reviewed as a change to the ban, and an
`overrideAttrs` that drops a phase would show there. Each module's `Cargo.lock`
is trust root too: a dependency bump can reach a re-exported macro that expands
to unsafe code the forbid does not see, so a lock change is reviewed as a change
to the ban.

The ban covers Saerskriven's own crates. Code inside a dependency is outside
it. [Building the executables](docs/build.md#the-webassembly-modules)
describes the boundary the modules share and each module's calls.

## Workflows and CI

Pin every GitHub Action to a full commit SHA, never a tag, with the
version in a trailing comment. Renovate bumps them. CI's static-checks
job fails an unpinned action (zizmor, hash-pin policy in
[`.github/zizmor.yml`](.github/zizmor.yml)).

Keep workflows injection-free. Never interpolate untrusted
`${{ github.event.* }}` or `${{ github.head_ref }}` into `run:` blocks.
Pass them through `env:` or intermediate files. CI's static-checks job
fails a violating expression (actionlint and zizmor both catch it).

## Diagrams

Diagrams are Mermaid, not ASCII art: a fenced ` ```mermaid ` block, never
box-drawing characters.
