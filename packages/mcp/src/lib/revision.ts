import { createHash } from 'node:crypto';

/**
 * A file's revision handle: `sha256:` and the lowercase hex digest of its
 * bytes, compared whole rather than parsed.
 */
export function revisionOf(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}
