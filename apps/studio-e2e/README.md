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
- `phone` re-runs the specs whose layout turns on the viewport on a `Pixel 7`
  preset. `playwright.config.ts` lists them and says why each is there.
- `pages` checks the production build below `/Saerskriven/`, including PDF
  assets, the social card, its text alternative, and the release version.
- `frame-time` measures a drag of the two-diagram model's `Web shop`, a
  process with flows at both ends, with one worker and one retry. Earlier
  project failures skip it. Other browser work must not compete with this
  measurement.

The Pages build uses a separate Vite cache to avoid reloading the development
page during tests. Its output and the Playwright reports stay under this
project's ignored `test-output/` directory.

A failed test keeps its trace and error context under
`test-output/playwright/output/`, except in `frame-time`, which records no
trace. When the smoke fails or times out in CI, the job uploads
`test-output/playwright/` as the `playwright-output` artifact for 14 days.
Open a trace with `pnpm exec playwright show-trace <trace.zip>`.

## Waiting on the canvas

Wait for `canvasSettled` from `src/studio.fixtures.ts` before sending a canvas
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
