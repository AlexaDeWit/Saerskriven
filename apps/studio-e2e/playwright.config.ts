import { defineConfig, devices } from '@playwright/test';

const frameTimeFloor = /drag-frame-time\.spec\.ts$/u;
const pagesExport = /pages-export\.spec\.ts$/u;
const phoneWidth = /@phone/u;
const phoneOnly = /@phone-only/u;
const pagesBasePath = '/Saerskriven';
const pagesPort = 4300;

// Browsers come from the flake (PLAYWRIGHT_BROWSERS_PATH points into the nix
// store), never from playwright's downloader. How to run and debug the suite,
// and what it leaves to other suites, is in README.md beside this file.
export default defineConfig({
  testDir: './src',
  outputDir: './test-output/playwright/output',
  // CI runs the suite as several jobs, so each one writes a blob report and a
  // failure merges them into the one HTML report. A local run has the whole
  // suite in one process and writes that report itself.
  reporter: process.env['CI']
    ? [['list'], ['blob', { outputDir: './test-output/playwright/blob' }]]
    : [
        ['list'],
        [
          'html',
          { outputFolder: './test-output/playwright/report', open: 'never' },
        ],
      ],
  forbidOnly: !!process.env['CI'],
  // Playwright's own default, stated as the root ceiling: it covers a cold
  // development server page load with two workers on a shared runner. A spec
  // that needs longer sets its own at the narrowest scope, with the reason
  // beside it.
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
  webServer: [
    // This command string is load-bearing twice. @nx/playwright parses it to
    // infer this project's `e2e` dependency on @saerskriven/studio:serve, and
    // in CI, where the server is not reusable and the plugin infers nothing,
    // Playwright runs the string itself as a nested nx invocation. Rewriting
    // it to invoke Vite directly would drop the inferred dependency here and
    // that invocation there, with nothing said either way.
    {
      command: 'pnpm exec nx run @saerskriven/studio:serve',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env['CI'],
      timeout: 120_000,
    },
    // The Pages preview builds the studio itself, so it reads the rasterizer
    // module too. It needs no dependency of its own: resvg-wasm:build is a
    // non-continuous dependency of `e2e`, which nx finishes before the task
    // starts either server.
    {
      command: 'bash scripts/preview-studio-pages.sh',
      cwd: '../..',
      env: {
        PAGES_BASE_PATH: pagesBasePath,
        PAGES_PREVIEW_PORT: String(pagesPort),
      },
      url: `http://localhost:${String(pagesPort)}${pagesBasePath}/`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    // CI splits `chromium` and `phone` across a shard matrix. Each of the two
    // runs every test as its own shard group, so the split follows the test
    // count rather than the file sizes. The projects below keep the default,
    // one group per file, because each runs on one worker anyway.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [frameTimeFloor, pagesExport],
      grepInvert: phoneOnly,
      fullyParallel: true,
    },
    // A phone viewport is the one the shell chrome has least room in, so a
    // test whose layout turns on the width carries the `@phone` tag and runs
    // under `phone` as well as under `chromium`, which holds the ruling that
    // the layout is the same at every width. The chrome card and its
    // submenus, a notice under the card, record and model properties rows,
    // the Link existing listbox, a collapsed summary with its marks, and the
    // gap between a corner handle and a threat badge measured on screen
    // (#447) carry it. A test tagged `@phone-only` reads what only a phone
    // width reaches, so `chromium` leaves it out. The preset carries the
    // viewport, the touch flags and the device pixel ratio together, so a
    // change of preset changes all three at once. An untagged test is about
    // behaviour that does not turn on the viewport, and runs under `chromium`
    // alone.
    {
      name: 'phone',
      use: { ...devices['Pixel 7'] },
      grep: phoneWidth,
      dependencies: ['chromium'],
      fullyParallel: true,
    },
    {
      name: 'pages',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${String(pagesPort)}${pagesBasePath}/`,
      },
      testMatch: pagesExport,
      dependencies: ['phone'],
      workers: 1,
    },
    // The floor reads what the machine gives the page, so it is comparable
    // only where no other browser shares the host: copies of this spec run at
    // the same time all fail, where the same spec alone reads not one frame
    // late. Hence one worker, and a dependency on the project carrying the
    // rest of the suite, so a plain local run reaches this one once the
    // others are done rather than beside them, while they keep their own
    // parallelism. CI reaches the same isolation another way: it runs `pages`
    // and `frame-time` together in a job of their own, with `--no-deps` and
    // one worker for the pair, on a runner the shard matrix never shares. The
    // gate requires that job, so a red elsewhere leaves the floor reported on
    // its own rather than reported green. A burst of activity elsewhere on
    // the host can still land inside the drag, so a single noisy run is
    // retried once and a second failure is the reading. The retry records no
    // trace: tracing paces the drag with screenshots and snapshots, and a
    // retry under more load than the first attempt is no second reading.
    // Both ceilings in the spec are regression signals, of a gross
    // regression rather than of correctness: a reading taken on #481's head
    // put a fivefold blow-up in per-frame live layout work over the share
    // ceiling and a twofold blow-up under it, and a live layout frozen
    // altogether reads clean. The share ceiling
    // does not move. The single-longest-frame ceiling sits above the band a
    // GitHub-hosted runner produces on its own (#309) and moves only with a
    // new reading of that band.
    {
      name: 'frame-time',
      use: { ...devices['Desktop Chrome'], trace: 'off' },
      testMatch: frameTimeFloor,
      dependencies: ['pages'],
      workers: 1,
      fullyParallel: false,
      retries: 1,
    },
  ],
});
