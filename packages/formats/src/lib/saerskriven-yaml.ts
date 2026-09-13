import { saerskrivenYamlV2WireSchema } from '@saerskriven/wire-saerskriven-yaml-v2';
import type { Codec } from './codec.js';
import { readSaerskrivenYaml } from './saerskriven-yaml-read.js';
import { writeSaerskrivenYaml } from './saerskriven-yaml-write.js';

/**
 * The Saerskriven YAML format as one {@link Codec}. `wire` is the version 2
 * schema from `@saerskriven/wire-saerskriven-yaml-v2`, the version a write
 * emits. A read also takes every earlier version, and a version 1 read
 * answers with the migrated version 2 document as its source.
 *
 * Both of the contract's write paths are the same path here: a write that
 * merges onto a source document and a write that projects the model produce
 * the same file, and neither reports a divergence.
 */
export const saerskrivenYamlCodec: Codec<typeof saerskrivenYamlV2WireSchema> = {
  wire: saerskrivenYamlV2WireSchema,
  read: readSaerskrivenYaml,
  write: writeSaerskrivenYaml,
};
