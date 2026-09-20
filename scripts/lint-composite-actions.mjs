#!/usr/bin/env node
// Shellcheck the `run:` blocks of the composite actions under .github/actions,
// which actionlint never reads: it lints workflow files only.
//
//   nix develop .#ci --command scripts/lint-composite-actions.mjs
//
// A composite step is already a valid job step, so each action's steps are
// carried verbatim into a synthetic workflow and actionlint is run over that.
// actionlint rather than shellcheck itself: nixpkgs packages actionlint as a
// wrapper that puts shellcheck on PATH for its own child process, so the dev
// shell holds no shellcheck of its own, and the expression sanitizing, the
// `shell:` mapping and the interpreter are then the ones a workflow gets.
//
// Reported back is everything actionlint says except the ten rules of 1.7.12
// that speak about the workflow this wrote rather than the action on disk, so
// a rule added to a later actionlint arrives as a failure rather than as
// silence. Denying the expression rule costs nothing: zizmor audits
// .github/actions and reports a template injection there. Exit 1 covers a
// finding and a check that could not run alike.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const actionsRoot = join(repoRoot, '.github', 'actions');
const actionNames = ['action.yml', 'action.yaml'];

// The steps of a composite action are carried in under this, at whatever
// indentation they already have: a block sequence may sit at its key's column.
const preamble = [
  'name: composite action run blocks',
  'on: push',
  'jobs:',
  '  composite:',
  '    runs-on: ubuntu-latest',
  '    steps:',
];

// The rules of actionlint 1.7.12 whose subject is `on:`, `runs-on:` or the
// job, which this wrote, or `uses:`, which no temporary file can resolve to a
// local action and which a SHA pin already hides. What is left reads the
// steps: shellcheck, pyflakes, syntax-check, deprecated-commands, shell-name,
// env-var, if-cond and id.
const workflowOnlyKinds = new Set([
  'action',
  'credentials',
  'events',
  'expression',
  'glob',
  'job-needs',
  'matrix',
  'permissions',
  'runner-label',
  'workflow-call',
]);

const runKey = /^\s+run:(\s|$)/;
const topLevelKey = (line) =>
  line !== '' && !line.startsWith(' ') && !line.startsWith('#');
const blank = (line) => line.trim() === '' || line.trim().startsWith('#');
const indentOf = (line) => line.length - line.trimStart().length;
const runBlocks = (lines) => lines.filter((line) => runKey.test(line)).length;
const count = (many, noun) => `${many} ${noun}${many === 1 ? '' : 's'}`;

// A key at exactly the indentation the runs: block opens with, so that an
// input named `using` or `steps` deeper in a step cannot stand in for it.
const keyAt = (line, indent, key) => {
  if (!line.startsWith(`${indent}${key}:`)) return null;
  return line.slice(indent.length + key.length + 1).trim();
};

// Any depth: a workflow reaches a local action by directory path, and nothing
// says that path is a child of .github/actions rather than a grandchild.
const actionFiles = (directory) => {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...actionFiles(path));
    else if (actionNames.includes(entry.name)) files.push(path);
  }
  return files.sort();
};

// The steps of the composite action, and the number to add to a line of the
// synthetic workflow to name the line of the action file it came from. The
// steps are carried across unchanged, so that number is one constant per file.
const carry = (path) => {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const runs = lines.findIndex((line) => line.startsWith('runs:'));
  if (runs === -1) return { problem: 'has no runs: block' };
  const rest = lines.slice(runs + 1);
  const ends = rest.findIndex(topLevelKey);
  const body = ends === -1 ? rest : rest.slice(0, ends);
  const opens = body.find((line) => !blank(line));
  if (opens === undefined) return { problem: 'has an empty runs: block' };
  const indent = opens.slice(0, indentOf(opens));
  const using = body.find((line) => keyAt(line, indent, 'using') !== null);
  if (using === undefined) return { problem: 'names no using: under runs:' };
  if (!using.includes('composite')) return { skipped: using.trim() };
  const steps = body.findIndex((line) => {
    const after = keyAt(line, indent, 'steps');
    return after === '' || after?.startsWith('#') === true;
  });
  if (steps === -1) return { problem: 'is composite but declares no steps:' };
  const under = body.slice(steps + 1);
  const sibling = under.findIndex(
    (line) =>
      !blank(line) &&
      indentOf(line) <= indent.length &&
      !line.trimStart().startsWith('- '),
  );
  const carried = sibling === -1 ? under : under.slice(0, sibling);
  return {
    steps: carried,
    blocks: runBlocks(carried),
    missed: runBlocks(lines.slice(runs)) - runBlocks(carried),
    offset: runs + 2 + steps - preamble.length,
  };
};

const lint = (file) => {
  let stdout = '';
  try {
    stdout = execFileSync('actionlint', ['-format', '{{json .}}', file], {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
  } catch (error) {
    stdout = typeof error.stdout === 'string' ? error.stdout : '';
  }
  try {
    const parsed = JSON.parse(stdout);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const checkAction = (action, file) => {
  const name = relative(repoRoot, action);
  const carried = carry(action);
  if (carried.skipped !== undefined) {
    console.log(`${name}: skipped, ${carried.skipped}`);
    return { blocks: 0, failures: [] };
  }
  if (carried.problem !== undefined) {
    return { blocks: 0, failures: [`${name} ${carried.problem}`] };
  }
  if (carried.missed > 0) {
    return {
      blocks: 0,
      failures: [
        `${name}: ${count(carried.missed, 'run block')} outside the steps: block this reads, so nothing shellchecked it`,
      ],
    };
  }

  writeFileSync(file, [...preamble, ...carried.steps].join('\n'));
  const reported = lint(file);
  if (reported === null) {
    return {
      blocks: 0,
      failures: [
        `actionlint answered nothing this could read for ${name}: run this inside nix develop .#ci`,
      ],
    };
  }

  const failures = reported
    .filter((finding) => !workflowOnlyKinds.has(finding.kind))
    .map(
      (finding) =>
        `${name}:${finding.line + carried.offset}:${finding.column}: ${finding.message} [${finding.kind}]`,
    );
  if (failures.length === 0) {
    console.log(
      carried.blocks === 0
        ? `${name}: only uses: steps, no run block to shellcheck`
        : `${name}: ${count(carried.blocks, 'run block')}, nothing reported`,
    );
  }
  return { blocks: carried.blocks, failures };
};

const main = () => {
  if (!existsSync(actionsRoot)) {
    console.error(
      `${relative(repoRoot, actionsRoot)} is not there, so no composite action was linted`,
    );
    return 1;
  }

  const actions = actionFiles(actionsRoot);
  if (actions.length === 0) {
    console.error(
      `no ${actionNames.join(' or ')} under .github/actions, so nothing was shellchecked`,
    );
    return 1;
  }

  const directory = mkdtempSync(join(tmpdir(), 'saerskriven-composite-'));
  const failures = [];
  let blocks = 0;
  try {
    for (const [index, action] of actions.entries()) {
      const checked = checkAction(action, join(directory, `${index}.yaml`));
      blocks += checked.blocks;
      failures.push(...checked.failures);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    return 1;
  }
  if (blocks === 0) {
    console.error(
      'no run block under .github/actions was shellchecked, so this check checked nothing',
    );
    return 1;
  }
  console.log(
    `${count(blocks, 'run block')} in ${count(actions.length, 'action file')}, no findings.`,
  );
  return 0;
};

process.exitCode = main();
