import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { HostRoots } from '../fixtures.js';
import { editableTree, modelFile, otmFile } from './edit.fixtures.js';

/** A link in the listed directory to the model of the unlisted one. */
export const leakFile = 'leak.yaml';

/** The model the launch directory holds, a copy of the editable one. */
export const insideFile = 'inside.yaml';

/**
 * The directories of one host session, every path a real path. `launch` is
 * where the server starts, holding a model and the OTM example, and `listed`
 * and `unlisted` are editable trees outside it, of which a host names the
 * first. `sibling` sits beside `listed` under a name that begins with its
 * own, and `alias` is a link to `listed`. `listed` also holds a link out to
 * the model of `unlisted`.
 */
export function hostTree(): {
  readonly launch: string;
  readonly listed: string;
  readonly unlisted: string;
  readonly sibling: string;
  readonly alias: string;
} {
  const launch = realpathSync(
    mkdtempSync(join(tmpdir(), 'saerskriven-mcp-launch-')),
  );
  const listed = editableTree().root;
  const unlisted = editableTree().root;
  const sibling = `${listed}-evil`;
  const alias = `${listed}-alias`;
  mkdirSync(sibling);
  copyFileSync(join(listed, modelFile), join(launch, insideFile));
  copyFileSync(join(listed, otmFile), join(launch, otmFile));
  copyFileSync(join(listed, modelFile), join(sibling, modelFile));
  symlinkSync(join(unlisted, modelFile), join(listed, leakFile));
  symlinkSync(listed, alias);
  return { launch, listed, unlisted, sibling, alias };
}

/**
 * A host that lists the given directories as `file://` URIs, with the number
 * of times a server has asked it.
 */
export function listingHost(...directories: readonly string[]): {
  readonly roots: HostRoots;
  readonly asked: () => number;
} {
  let asked = 0;
  return {
    roots: () => {
      asked += 1;
      return {
        roots: directories.map((directory) => ({
          uri: pathToFileURL(directory).href,
        })),
      };
    },
    asked: () => asked,
  };
}
