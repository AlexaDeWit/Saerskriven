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
  assets, the social card, its text alternative, the release version, each
  language, and a bundle without the development pseudo-locale.
- `frame-time` measures a drag of `Web shop`, a process with flows at both
  ends, in a scene the spec builds from three offset copies of the
  two-diagram model's storefront diagram, with one worker and one retry.
  Earlier project failures skip it locally, where CI runs it in a job of its
  own whatever the rest of the suite did. Other browser work must not compete
  with this measurement.

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

`firefox` and `webkit` run what `chromium` runs, in the other two engines the
studio supports. They exist only where `SAERSKRIVEN_E2E_OTHER_ENGINES` is `1`,
so a plain run and a pull request leave them out. Run them inside
`nix develop .#nightly`, the shell that gives the flake's WebKit an EGL driver
on a host that is not NixOS:

```sh
SAERSKRIVEN_E2E_OTHER_ENGINES=1 pnpm nx e2e @saerskriven/studio-e2e -- \
  --project=webkit --no-deps src/files.spec.ts
```

CI runs both on `main` once a night, outside the gate, with two shards per
engine and one worker per runner. The shards use the same test selectors,
deadlines and zero retries. Each test keeps its own concurrent pages
([Nightly browsers](../../.agents/orchestration.md#nightly-browsers)).

The Pages build uses a separate Vite cache to avoid reloading the development
page during tests. Its output and the Playwright reports stay under this
project's ignored `test-output/` directory.

A failed test keeps its trace and error context under
`test-output/playwright/output/`, except in `frame-time`, which records no
trace. A CI job that fails or times out uploads that directory for 14 days,
as `playwright-output-shard-<n>` from a shard leg,
`playwright-output-pages-floor` from the floor job, and
`playwright-output-<engine>-shard-<n>` from a nightly leg. Open a trace with
`pnpm exec playwright show-trace <trace.zip>`.

A local run writes the HTML report under `test-output/playwright/report/`. In
CI each job writes a blob report in its place, uploaded for a day as
`playwright-blob-shard-<n>` or `playwright-blob-pages-floor`. When a browser
job goes red, the `Merged Playwright report` job merges every blob into one
HTML report and uploads it as `playwright-report` for 14 days.

Nightly shards upload `playwright-blob-<engine>-shard-<n>` for one day.
A merge job per engine requires both blobs and uses Playwright's merger to
write `playwright-report-<engine>` for 14 days and `playwright-json-<engine>`
for one day. These reports include failed tests. Missing required artifacts
fail their job, and incomplete evidence cannot close the nightly tracker.

## Waiting on the canvas

Wait for `canvasSettled` from `src/canvas.fixtures.ts` before sending a canvas
gesture. Opening a model fits its diagram after React Flow measures the
canvas. A click sent during that fit can land at the wrong position.
The fixture reads the viewport transform on animation frames and waits for
three consecutive matches. Wall-clock polls can fall between slow frames
and report rest before a fit or pan finishes.

## Scope

`tests/` holds unit specs for shared browser helpers: shortcut chords against
the command registry, and the path comparison used by the round-trip test.

The browser suite does not check the browser-owned `beforeunload` prompt.
The file-menu unit specs cover its registration. Dedicated boundary deletion
coverage is absent. The canvas package owns detailed glyph and stylesheet
checks. Automated accessibility checks do not replace manual screen-reader
review. A pull request runs Chromium only, the phone project through a device
preset rather than another engine, and Firefox and WebKit run nightly.

Current interaction limitations live in
[Using the studio](../../docs/studio.md#current-limitations).
