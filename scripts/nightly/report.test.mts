import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { z } from 'zod';
import {
  linkTools,
  temporaryWorkspace,
  workflow,
  workspaceRoot,
} from '../tools.fixtures.mts';

const title = 'Nightly browser run is red in Firefox or WebKit';
const runUrl = 'https://github.com/example/studio/actions/runs/42';
const commit = 'a'.repeat(40);

const passingTitle = 'opens a model';
const spec = (specTitle: string, ok: boolean, line: number) => ({
  title: specTitle,
  ok,
  file: 'files.spec.ts',
  line,
});
const report = ({
  failing = [],
  failingTitle = 'keeps the name @phone',
  errors = [],
}: Readonly<{
  failing?: readonly number[];
  failingTitle?: string;
  errors?: readonly object[];
}> = {}) => ({
  suites: [
    {
      title: 'files.spec.ts',
      specs: [spec(passingTitle, true, 12)],
      suites: [
        {
          title: 'saving',
          specs: failing.map((line) => spec(failingTitle, false, line)),
        },
      ],
    },
  ],
  errors,
});
const green = report();
const red = report({ failing: [40] });

const fakeGh = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const flag = args.indexOf('--body-file');
const comment = args.indexOf('--comment');
const body = flag === -1 ? (comment === -1 ? '' : args[comment + 1]) : fs.readFileSync(args[flag + 1], 'utf8');
const inherited = ['HOME', 'GH_TOKEN', 'GITHUB_TOKEN'].filter((name) => name in process.env);
fs.appendFileSync(process.env.NIGHTLY_TEST_LOG, JSON.stringify({ args, body, inherited }) + '\\n');
const tracker = JSON.parse(process.env.NIGHTLY_TEST_TRACKER);
if (args[1] !== 'list') process.exit(tracker.writesFail ? 1 : 0);
if (tracker.listFails) process.exit(1);
const flagValue = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const wanted = flagValue('--state', 'open');
const listed = tracker.issues
  .filter(({ state }) => wanted === 'all' || state === wanted)
  .sort((newer, older) => older.number - newer.number)
  .slice(0, Number(flagValue('--limit', '30')));
console.log(JSON.stringify(listed.map(({ number, title }) => ({ number, title }))));
`;
const callSchema = z.object({
  args: z.array(z.string()),
  body: z.string(),
  inherited: z.array(z.string()),
});

type Reports = Readonly<Record<string, object | string>>;
type Night = Readonly<{
  args?: readonly string[];
  browsersResult?: string;
  gh?: boolean;
  issues?: readonly Readonly<{
    number: number;
    title: string;
    state: 'open' | 'closed';
  }>[];
  listFails?: boolean;
  writesFail?: boolean;
}>;

const night = (
  reports: Reports,
  {
    args = [],
    browsersResult = 'success',
    gh = true,
    issues = [],
    listFails = false,
    writesFail = false,
  }: Night = {},
) => {
  const directory = temporaryWorkspace();
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  mkdirSync(join(directory, 'reports'));
  linkTools(bin, [
    'bash',
    'jq',
    'mktemp',
    'rm',
    'wc',
    'tr',
    'head',
    'sed',
    'cat',
  ]);
  if (gh) writeFileSync(join(bin, 'gh'), fakeGh, { mode: 0o755 });
  const log = join(directory, 'calls.jsonl');
  writeFileSync(log, '');
  for (const [engine, content] of Object.entries(reports))
    writeFileSync(
      join(directory, 'reports', `${engine}.json`),
      typeof content === 'string' ? content : JSON.stringify(content),
    );
  const result = spawnSync(
    'bash',
    [
      join(workspaceRoot, 'scripts/nightly/report.sh'),
      ...args,
      join(directory, 'reports'),
      'firefox',
      'webkit',
    ],
    {
      encoding: 'utf8',
      env: {
        PATH: bin,
        RUN_URL: runUrl,
        GITHUB_SHA: commit,
        BROWSERS_RESULT: browsersResult,
        NIGHTLY_TEST_LOG: log,
        NIGHTLY_TEST_TRACKER: JSON.stringify({ issues, listFails, writesFail }),
      },
    },
  );
  const calls = readFileSync(log, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => callSchema.parse(JSON.parse(line)));
  return {
    result,
    calls,
    writes: calls.filter(({ args: [, action] }) => action !== 'list'),
  };
};

void test('a green night with no open tracker writes nothing', () => {
  const { result, writes } = night(
    { firefox: green, webkit: green },
    {
      issues: [
        { number: 30, title, state: 'closed' },
        { number: 31, title: `${title}, again`, state: 'open' },
      ],
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(writes, []);
});

void test('a green night closes the open tracker as completed with run evidence', () => {
  const { result, writes } = night(
    { firefox: green, webkit: green },
    { issues: [{ number: 41, title, state: 'open' }] },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0]?.args.slice(0, 6), [
    'issue',
    'close',
    '41',
    '--reason',
    'completed',
    '--comment',
  ]);
  assert.ok(writes[0]?.body.includes(runUrl));
  assert.ok(writes[0]?.body.includes(commit));
  assert.ok(writes[0]?.body.includes('Both browser jobs succeeded.'));
});

void test('a green dry run names the tracker it would close and writes nothing', () => {
  const { result, writes } = night(
    { firefox: green, webkit: green },
    { args: ['--dry-run'], issues: [{ number: 41, title, state: 'open' }] },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(writes, []);
  assert.ok(result.stdout.includes('Would close #41:'));
  assert.ok(result.stdout.includes(runUrl));
});

void test('green reports without a successful job result close nothing', () => {
  for (const browsersResult of ['', 'failure', 'cancelled', 'skipped']) {
    const { result, writes } = night(
      { firefox: green, webkit: green },
      { browsersResult, issues: [{ number: 41, title, state: 'open' }] },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      writes.some(({ args }) => args[1] === 'close'),
      false,
    );
  }
});

void test('a red night with no tracking issue open opens it, with the run, the commit and the failing specs by engine', () => {
  const { result, writes } = night(
    { firefox: red, webkit: green },
    { issues: [{ number: 12, title: `${title}, again`, state: 'open' }] },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(writes.length, 1);
  const write = writes[0];
  assert.ok(write);
  const { args, body } = write;
  assert.deepEqual(args.slice(0, 5), [
    'issue',
    'create',
    '--title',
    title,
    '--body-file',
  ]);
  assert.ok(body.includes(runUrl));
  assert.ok(body.includes(commit));
  assert.match(
    body,
    /^ {4}files\.spec\.ts:40 › saving › keeps the name @phone$/mu,
  );
  assert.equal(body.includes(passingTitle), false);
  const listed = body.indexOf('files.spec.ts:40');
  assert.ok(body.includes('firefox') && body.indexOf('firefox') < listed);
  assert.ok(listed < body.indexOf('webkit'));
});

void test('a red night comments on the open tracking issue and neither opens nor closes one', () => {
  const { result, calls } = night(
    { firefox: green, webkit: red },
    {
      issues: [
        { number: 52, title, state: 'open' },
        { number: 41, title, state: 'open' },
        { number: 7, title: 'Something else', state: 'open' },
      ],
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls[0]?.args, [
    'issue',
    'list',
    '--state',
    'open',
    '--limit',
    '1000',
    '--json',
    'number,title',
  ]);
  assert.deepEqual(calls[1]?.args.slice(0, 4), [
    'issue',
    'comment',
    '41',
    '--body-file',
  ]);
  assert.ok(calls[1]?.body.includes('files.spec.ts:40'));
});

void test('a tracking issue older than thirty newer open issues is still found', () => {
  const newer = Array.from({ length: 30 }, (_, index) => ({
    number: 42 + index,
    title: `Something newer ${String(index)}`,
    state: 'open' as const,
  }));
  const { result, writes } = night(
    { firefox: red, webkit: green },
    { issues: [{ number: 41, title, state: 'open' }, ...newer] },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    writes.map(({ args }) => args.slice(0, 3)),
    [['issue', 'comment', '41']],
  );
});

void test('a closed tracking issue gets no comment: the night opens a new one', () => {
  const { result, writes } = night(
    { firefox: red, webkit: green },
    { issues: [{ number: 30, title, state: 'closed' }] },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    writes.map(({ args }) => args.slice(0, 2)),
    [['issue', 'create']],
  );
});

void test('an engine whose job left no readable report is red', () => {
  const truncated: Reports = { firefox: green, webkit: '{"suites": [' };
  for (const reports of [{ firefox: green }, truncated]) {
    const { result, writes } = night(reports, {
      issues: [{ number: 41, title, state: 'open' }],
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(writes.length, 1);
    assert.equal(writes[0]?.args[1], 'comment');
  }
});

void test('an error outside any spec makes its engine red', () => {
  const { result, writes } = night(
    {
      firefox: report({
        errors: [{ message: 'the web server never answered' }],
      }),
      webkit: green,
    },
    { issues: [{ number: 41, title, state: 'open' }] },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.args[1], 'comment');
});

void test('a failed job is a red night even where every report is green', () => {
  const { result, writes } = night(
    { firefox: green, webkit: green },
    { browsersResult: 'failure' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(writes.length, 1);
  assert.ok(writes[0]?.body.includes('failure'));
});

void test('an engine that fails every spec lists the first hundred and counts them all', () => {
  const everySpec = report({
    failing: Array.from({ length: 150 }, (_, line) => line + 1),
  });
  const { writes } = night({ firefox: everySpec, webkit: green });
  const body = writes[0]?.body ?? '';
  assert.equal(body.match(/^ {4}files\.spec\.ts:/gmu)?.length, 100);
  assert.ok(body.includes('150'));
});

void test('a title holding a line break stays one line of code, so what follows it notifies no one', () => {
  const broken = report({
    failing: [40],
    failingTitle: 'keeps the name\r\n@someone\r@other',
  });
  const { writes } = night({ firefox: broken, webkit: green });
  const body = writes[0]?.body ?? '';
  assert.equal(body.includes('\r'), false);
  assert.match(
    body,
    /^ {4}files\.spec\.ts:40 › saving › keeps the name @someone @other$/mu,
  );
});

void test('a dry run names the issue it would comment on and writes nothing', () => {
  const { result, writes } = night(
    { firefox: red, webkit: green },
    { args: ['--dry-run'], issues: [{ number: 41, title, state: 'open' }] },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(writes, []);
  assert.ok(result.stdout.includes('#41'));
  assert.ok(result.stdout.includes('files.spec.ts:40'));
});

void test('a listing that fails writes nothing on a red or green night', () => {
  for (const firefox of [red, green]) {
    const { result, writes } = night(
      { firefox, webkit: green },
      { listFails: true },
    );
    assert.notEqual(result.status, 0);
    assert.deepEqual(writes, []);
  }
});

void test('a write GitHub refuses fails the report, after one attempt', () => {
  const refused = [
    { issues: [], attempt: 'create', firefox: red },
    {
      issues: [{ number: 41, title, state: 'open' as const }],
      attempt: 'comment',
      firefox: red,
    },
    {
      issues: [{ number: 41, title, state: 'open' as const }],
      attempt: 'close',
      firefox: green,
    },
  ];
  for (const { issues, attempt, firefox } of refused) {
    const { result, writes } = night(
      { firefox, webkit: green },
      { issues, writesFail: true },
    );
    assert.notEqual(result.status, 0, attempt);
    assert.deepEqual(
      writes.map(({ args }) => args.slice(0, 2)),
      [['issue', attempt]],
    );
  }
});

void test('the script under test reaches no gh but the fake and is handed no credentials', () => {
  const reports = { firefox: red, webkit: green };
  const absent = night(reports, { gh: false, args: ['--dry-run'] });
  assert.equal(absent.result.status, 127);
  const { calls } = night(reports);
  assert.equal(calls.length, 2);
  for (const { inherited } of calls) assert.deepEqual(inherited, []);
});

const nightly = workflow('nightly-browsers.yml');
const gate = readFileSync(
  join(workspaceRoot, '.github/workflows/ci.yml'),
  'utf8',
);
const setupAction = readFileSync(
  join(workspaceRoot, '.github/actions/setup-toolchain/action.yml'),
  'utf8',
);

void test('the nightly run starts on a schedule or by hand, and the gate never names its engines', () => {
  assert.deepEqual(Object.keys(nightly.on).toSorted(), [
    'schedule',
    'workflow_dispatch',
  ]);
  assert.equal(gate.includes('SAERSKRIVEN_E2E_OTHER_ENGINES'), false);
});

void test('each engine runs its suite in the nightly shell, which neither the gate nor the setup action it shares enters', () => {
  const suite = nightly.jobs['browsers']?.steps?.find(({ run }) =>
    run?.includes('nx e2e'),
  );
  assert.ok(suite?.run?.startsWith('nix develop .#nightly --command'));
  assert.equal(gate.includes('.#nightly'), false);
  assert.equal(setupAction.includes('.#nightly'), false);
});

void test('only the report job may write, to issues alone, and only for a run on main nobody cancelled', () => {
  assert.deepEqual(nightly.permissions, {});
  assert.deepEqual(
    Object.entries(nightly.jobs)
      .filter(([, job]) =>
        Object.values(job.permissions ?? {}).includes('write'),
      )
      .map(([name]) => name),
    ['report'],
  );
  assert.deepEqual(nightly.jobs['report']?.permissions, {
    contents: 'read',
    issues: 'write',
  });
  assert.equal(
    nightly.jobs['report']?.if?.trim().replace(/\s+/gu, ' '),
    "!cancelled() && github.ref == 'refs/heads/main'",
  );
});
