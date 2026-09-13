import { saerskrivenYamlWireSchema } from '@saerskriven/wire-saerskriven-yaml';
import type { Codec } from './codec.js';
import { readSaerskrivenYaml } from './saerskriven-yaml-read.js';
import { writeSaerskrivenYaml } from './saerskriven-yaml-write.js';

/**
 * The Saerskriven YAML format as one {@link Codec}: the wire schema from
 * `@saerskriven/wire-saerskriven-yaml`, the read that maps a file onto the
 * internal model, and the write that projects the model back.
 *
 * Both of the contract's write paths are the same path here: a write that
 * merges onto a source document and a write that projects the model produce
 * the same file. The one thing the format does not hold is an assumption's
 * model link, which the write reports `narrowed`.
 */
export const saerskrivenYamlCodec: Codec<typeof saerskrivenYamlWireSchema> = {
  wire: saerskrivenYamlWireSchema,
  read: readSaerskrivenYaml,
  write: writeSaerskrivenYaml,
};
