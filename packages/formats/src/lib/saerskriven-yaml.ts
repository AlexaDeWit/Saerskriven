import { saerskrivenYamlV2WireSchema } from '@saerskriven/wire-saerskriven-yaml-v2';
import type { Codec } from './codec.js';
import { readSaerskrivenYaml } from './saerskriven-yaml-read.js';
import { writeSaerskrivenYaml } from './saerskriven-yaml-write.js';

/**
 * The native format as one {@link Codec}, with the version 2 schema as
 * `wire`. A read takes every released version and returns a version 1 file's
 * document migrated to version 2. A write projects the whole model whether
 * or not it is given a source, and reports nothing.
 */
export const saerskrivenYamlCodec: Codec<typeof saerskrivenYamlV2WireSchema> = {
  wire: saerskrivenYamlV2WireSchema,
  read: readSaerskrivenYaml,
  write: writeSaerskrivenYaml,
};
