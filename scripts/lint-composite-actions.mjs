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
// Only the rules that read the script are reported, plus a synthetic workflow
// that does not parse, which would mean this transformed an action into
// something that is no longer a workflow. The rest is dropped: an action's
// `inputs` context does not exist in a workflow, so actionlint's expression
// and action rules there speak about a file that is not the one on disk. Exit
// 1 covers a finding and a check that could not run alike.
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

const reportedKinds = new Set(['shellcheck', 'pyflakes', 'syntax-check']);
const usingKey = /^\s+using:\s/;
const stepsKey = /^\s+steps:\s*(#.*)?$/;
const runKey = /^\s+run:(\s|$)/;
const topLevelKey = (line) =>
  line !== '' && !line.startsWith(' ') && !line.startsWith('#');
const count = (many, noun) => `${many} ${noun}${many === 1 ? '' : 's'}`;

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
  const lines = readFileSync(path, 'utf8').split('\n');
  const runs = lines.findIndex((line) => line.startsWith('runs:'));
  if (runs === -1) return { problem: 'has no runs: block' };
  const rest = lines.slice(runs + 1);
  const ends = rest.findIndex(topLevelKey);
  const body = ends === -1 ? rest : rest.slice(0, ends);
  const using = body.find((line) => usingKey.test(line));
  if (using === undefined) return { problem: 'names no using: under runs:' };
  if (!using.includes('composite')) return { skipped: using.trim() };
  const steps = body.findIndex((line) => stepsKey.test(line));
  if (steps === -1) return { problem: 'is composite but declares no steps:' };
  return {
    steps: body.slice(steps + 1),
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

  const blocks = carried.steps.filter((line) => runKey.test(line)).length;
  const failures = reported
    .filter((finding) => reportedKinds.has(finding.kind))
    .map(
      (finding) =>
        `${name}:${finding.line + carried.offset}:${finding.column}: ${finding.message} [${finding.kind}]`,
    );
  if (failures.length === 0) {
    console.log(`${name}: ${count(blocks, 'run block')}, nothing reported`);
  }
  return { blocks, failures };
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
  console.log(
    `${count(blocks, 'run block')} in ${count(actions.length, 'action file')}, no findings.`,
  );
  return 0;
};

process.exitCode = main();
