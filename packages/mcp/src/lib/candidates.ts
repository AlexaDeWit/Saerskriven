import { Either } from 'effect';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { extensionOf, withinRoot, type ModelWorkspace } from './workspace.js';

/**
 * Every file under the root with a model extension, sorted by path. The
 * extension alone decides, so an entry is a candidate rather than a read
 * model. The walk follows no symbolic link, skips dotfiles and
 * `node_modules`, descends 8 directories and stops one past 200 files, which
 * it reports as `truncated`. An unreadable directory contributes nothing.
 */
export function candidateFiles(workspace: ModelWorkspace): {
  readonly files: readonly string[];
  readonly truncated: boolean;
} {
  const found: string[] = [];
  let frontier: readonly string[] = [workspace.root];
  for (let depth = 0; depth <= candidateDepth; depth += 1) {
    const next: string[] = [];
    for (const directory of frontier) {
      for (const entry of entriesOf(directory)) {
        if (found.length > candidateLimit) {
          break;
        }
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          next.push(path);
        } else if (entry.isFile() && modelExtensions.has(extensionOf(path))) {
          found.push(withinRoot(workspace, path));
        }
      }
    }
    frontier = next;
  }
  found.sort();
  return {
    files: found.slice(0, candidateLimit),
    truncated: found.length > candidateLimit,
  };
}

const candidateDepth = 8;

const candidateLimit = 200;

const modelExtensions = new Set(['.json', '.yaml', '.yml']);

const skippedDirectories = new Set(['node_modules']);

function entriesOf(directory: string) {
  return Either.getOrElse(
    Either.try(() => readdirSync(directory, { withFileTypes: true })),
    () => [],
  ).filter(
    (entry) =>
      !entry.name.startsWith('.') && !skippedDirectories.has(entry.name),
  );
}
