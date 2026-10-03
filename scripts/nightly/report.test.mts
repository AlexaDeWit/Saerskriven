import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';

const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
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
const report = (failingLines: readonly number[]) => ({
  suites: [
    {
      title: 'files.spec.ts',
      specs: [spec(passingTitle, true, 12)],
      suites: [
        {
          title: 'saving',
          specs: failingLines.map((line) =>
            spec('keeps the name @phone', false, line),
          ),
        },
      ],
    },
  ],
  errors: [],
});
const green = report([]);
const red = report([40]);

const fakeGh = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const flag = args.indexOf('--body-file');
const body = flag === -1 ? '' : fs.readFileSync(args[flag + 1], 'utf8');
fs.appendFileSync(process.env.NIGHTLY_TEST_LOG, JSON.stringify({ args, body }) + '\\n');
if (args[1] === 'list') {
  if (process.env.NIGHTLY_TEST_OPEN === '') process.exit(1);
  console.log(process.env.NIGHTLY_TEST_OPEN);
}
`;
const callSchema = z.object({ args: z.array(z.string()), body: z.string() });

type Reports = Readonly<Record<string, object | string>>;
type Night = Readonly<{
  args?: readonly string[];
  browsersResult?: string;
  open?: readonly Readonly<{ number: number; title: string }>[] | 'unreadable';
}>;

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

const night = (
  reports: Reports,
  { args = [], browsersResult = 'success', open = [] }: Night = {},
) => {
  const directory = mkdtempSync(join(tmpdir(), 'nightly-report-'));
  directories.push(directory);
  mkdirSync(join(directory, 'bin'));
  mkdirSync(join(directory, 'reports'));
  writeFileSync(join(directory, 'bin/gh'), fakeGh, { mode: 0o755 });
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
        ...process.env,
        PATH: `${join(directory, 'bin')}:${process.env['PATH'] ?? ''}`,
        RUN_URL: runUrl,
        GITHUB_SHA: commit,
        BROWSERS_RESULT: browsersResult,
        NIGHTLY_TEST_LOG: log,
        NIGHTLY_TEST_OPEN: open === 'unreadable' ? '' : JSON.stringify(open),
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

void test('a green night asks GitHub nothing and writes nothing', () => {
  const { result, calls } = night({ firefox: green, webkit: green });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(calls, []);
});

void test('a red night with no tracking issue open opens it, with the run, the commit and the failing specs by engine', () => {
  const { result, writes } = night(
    { firefox: red, webkit: green },
    { open: [{ number: 12, title: `${title}, again` }] },
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
      open: [
        { number: 52, title },
        { number: 41, title },
        { number: 7, title: 'Something else' },
      ],
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    calls.map(({ args }) => args.slice(0, 3)),
    [
      ['issue', 'list', '--state'],
      ['issue', 'comment', '41'],
    ],
  );
  assert.ok(calls[1]?.body.includes('files.spec.ts:40'));
});

void test('an engine whose job left no readable report is red', () => {
  const truncated: Reports = { firefox: green, webkit: '{"suites": [' };
  for (const reports of [{ firefox: green }, truncated]) {
    const { result, writes } = night(reports);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(writes.length, 1);
  }
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
  const everySpec = report(Array.from({ length: 150 }, (_, line) => line + 1));
  const { writes } = night({ firefox: everySpec, webkit: green });
  const body = writes[0]?.body ?? '';
  assert.equal(body.match(/^ {4}files\.spec\.ts:/gmu)?.length, 100);
  assert.ok(body.includes('150'));
});

void test('a dry run names the issue it would comment on and writes nothing', () => {
  const { result, writes } = night(
    { firefox: red, webkit: green },
    { args: ['--dry-run'], open: [{ number: 41, title }] },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(writes, []);
  assert.ok(result.stdout.includes('#41'));
  assert.ok(result.stdout.includes('files.spec.ts:40'));
});

void test('a listing that fails opens nothing, so no second tracking issue appears', () => {
  const { result, writes } = night(
    { firefox: red, webkit: green },
    { open: 'unreadable' },
  );
  assert.notEqual(result.status, 0);
  assert.deepEqual(writes, []);
});

const workflowSchema = z.object({
  on: z.record(z.string(), z.unknown()),
  permissions: z.record(z.string(), z.string()),
  jobs: z.record(
    z.string(),
    z.object({
      if: z.string().optional(),
      permissions: z.record(z.string(), z.string()),
    }),
  ),
});
const workflowText = (name: string) =>
  readFileSync(join(workspaceRoot, '.github/workflows', name), 'utf8');
const nightly = workflowSchema.parse(
  parse(workflowText('nightly-browsers.yml')),
);

void test('the nightly run starts on a schedule or by hand, and the gate never names its engines', () => {
  assert.deepEqual(Object.keys(nightly.on).toSorted(), [
    'schedule',
    'workflow_dispatch',
  ]);
  assert.equal(
    workflowText('ci.yml').includes('SAERSKRIVEN_E2E_OTHER_ENGINES'),
    false,
  );
});

void test('only the report job may write, to issues alone, and only for a run on main', () => {
  assert.deepEqual(nightly.permissions, {});
  assert.deepEqual(
    Object.entries(nightly.jobs)
      .filter(([, job]) => Object.values(job.permissions).includes('write'))
      .map(([name]) => name),
    ['report'],
  );
  assert.deepEqual(nightly.jobs['report']?.permissions, {
    contents: 'read',
    issues: 'write',
  });
  assert.match(
    nightly.jobs['report']?.if ?? '',
    /github\.ref == 'refs\/heads\/main'/u,
  );
});
