import { saerskrivenYamlV3WireSchema } from '@saerskriven/wire-saerskriven-yaml-v3';
import type { Codec } from './codec.js';
import { readSaerskrivenYaml } from './saerskriven-yaml-read.js';
import { writeSaerskrivenYaml } from './saerskriven-yaml-write.js';

/**
 * The native format as one {@link Codec}, with the version 3 schema as
 * `wire`. A read takes every released version and returns its document
 * brought to version 3. A write projects the whole model whether or not it
 * is given a source, as version 2 while version 2 holds the model and as
 * version 3 once it does not, and reports nothing.
 */
export const saerskrivenYamlCodec: Codec<typeof saerskrivenYamlV3WireSchema> = {
  wire: saerskrivenYamlV3WireSchema,
  keepsNarrowed: false,
  read: readSaerskrivenYaml,
  write: writeSaerskrivenYaml,
};
