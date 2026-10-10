import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';

/** Repository containing the tooling under scripts. */
export const workspaceRoot = fileURLToPath(new URL('../', import.meta.url));

const scratch: string[] = [];
afterEach(() => {
  for (const path of scratch.splice(0)) {
    rmSync(path, { force: true, recursive: true });
  }
});

/** Create an isolated workspace removed after the test. */
export const temporaryWorkspace = (): string => {
  const cwd = mkdtempSync(join(tmpdir(), 'saerskriven-tools-'));
  scratch.push(cwd);
  return cwd;
};

/** Link the named tools and node into a directory, for a PATH that reaches nothing else. */
export const linkTools = (bin: string, tools: readonly string[]): void => {
  for (const tool of tools) {
    const found = spawnSync('bash', ['-c', 'command -v "$1"', 'probe', tool], {
      encoding: 'utf8',
    });
    assert.equal(found.status, 0, `${tool} is not on PATH`);
    symlinkSync(found.stdout.trim(), join(bin, tool));
  }
  symlinkSync(process.execPath, join(bin, 'node'));
};

const concurrencySchema = z.object({
  group: z.string(),
  'cancel-in-progress': z.union([z.string(), z.boolean()]),
});
const permissionsSchema = z.record(z.string(), z.string());
const jobSchema = z.object({
  name: z.string(),
  concurrency: concurrencySchema.optional(),
  strategy: z
    .object({
      matrix: z.record(z.string(), z.array(z.unknown())).optional(),
    })
    .optional(),
  needs: z.union([z.string(), z.array(z.string())]).optional(),
  if: z.string().optional(),
  outputs: z.record(z.string(), z.string()).optional(),
  permissions: permissionsSchema.optional(),
  steps: z
    .array(
      z.object({
        name: z.string(),
        run: z.string().optional(),
        uses: z.string().optional(),
        if: z.string().optional(),
        env: z.record(z.string(), z.string()).optional(),
        with: z.record(z.string(), z.unknown()).optional(),
        'continue-on-error': z.union([z.string(), z.boolean()]).optional(),
        'timeout-minutes': z.number().optional(),
      }),
    )
    .optional(),
});
const workflowSchema = z.object({
  on: z.record(z.string(), z.unknown()),
  concurrency: concurrencySchema,
  permissions: permissionsSchema.optional(),
  jobs: z.record(z.string(), jobSchema),
});

/** Read a workflow under .github/workflows by file name. */
export const workflow = (name: string) =>
  workflowSchema.parse(
    parse(readFileSync(join(workspaceRoot, '.github/workflows', name), 'utf8')),
  );
