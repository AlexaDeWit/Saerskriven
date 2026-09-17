# The studio's browser suite

Browser tests cover layout, focus, pointer and touch gestures, file input,
downloads, and accessibility. Use unit tests for behaviour that does not need
a browser.

## Running the suite

Run inside `nix develop`:

```sh
pnpm nx e2e @saerskriven/studio-e2e
```

Browsers come from the flake. `src/version-pairing.spec.ts` checks that the
catalog's `@playwright/test` version matches the flake's driver.

`playwright.config.ts` starts the development server and a Pages preview.
The projects run in order:

- `chromium` runs the main browser specs.
- `phone` re-runs the tests tagged `@phone`, whose layout turns on the
  viewport, on a `Pixel 7` preset, and runs the tests tagged `@phone-only`.
  Tag a test `@phone` when its layout depends on the width.
  `playwright.config.ts` says why the project exists.
- `pages` checks the production build below `/Saerskriven/`, including PDF
  assets, the social card, its text alternative, and the release version.
- `frame-time` measures a drag of `Web shop`, a process with flows at both
  ends, in a scene the spec builds from three offset copies of the
  two-diagram model's storefront diagram, with one worker and one retry.
  Earlier project failures skip it. Other browser work must not compete with
  this measurement.

That order is what a plain local run follows. CI splits the suite across two
gating jobs that run beside each other, each passing `--no-deps` so a job runs
the projects it names and no others. `Playwright smoke (n/4)` is a four-way
shard matrix over `chromium` and `phone`, which run every test as its own
shard group, so the legs split by test count. `Playwright Pages and frame-time
floor` runs `pages` and `frame-time` with one worker for the pair, on a runner
the matrix never shares. Reproduce one shard leg with:

```sh
pnpm nx e2e @saerskriven/studio-e2e -- \
  --project=chromium --project=phone --no-deps --shard=1/4
```

The Pages build uses a separate Vite cache to avoid reloading the development
page during tests. Its output and the Playwright reports stay under this
project's ignored `test-output/` directory.

A failed test keeps its trace and error context under
`test-output/playwright/output/`, except in `frame-time`, which records no
trace. A CI job that fails or times out uploads that directory for 14 days,
as `playwright-output-shard-<n>` from a shard leg and
`playwright-output-pages-floor` from the floor job. Open a trace with
`pnpm exec playwright show-trace <trace.zip>`.

A local run writes the HTML report under `test-output/playwright/report/`. In
CI each job writes a blob report in its place, uploaded for a day as
`playwright-blob-shard-<n>` or `playwright-blob-pages-floor`. When a browser
job goes red, the `Merged Playwright report` job merges every blob into one
HTML report and uploads it as `playwright-report` for 14 days.

## Waiting on the canvas

Wait for `canvasSettled` from `src/canvas.fixtures.ts` before sending a canvas
gesture. Opening a model fits its diagram after React Flow measures the
canvas. A click sent during that fit can land at the wrong position.
The fixture polls the viewport transform until consecutive readings match.

## Scope

`tests/` holds unit specs for shared browser helpers: shortcut chords against
the command registry, and the path comparison used by the round-trip test.

The browser suite does not check the browser-owned `beforeunload` prompt.
The file-menu unit specs cover its registration. Dedicated boundary deletion
coverage is absent. The canvas package owns detailed glyph and stylesheet
checks. Automated accessibility checks do not replace manual screen-reader
review. The configured browser projects use Chromium only, the phone one
through a device preset rather than another engine.

Current interaction limitations live in
[Using the studio](../../docs/studio.md#current-limitations).
