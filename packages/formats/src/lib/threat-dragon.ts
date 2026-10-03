import { threatDragonWireSchema } from '@saerskriven/wire-threat-dragon';
import type { Codec } from './codec.js';
import { readThreatDragon } from './threat-dragon-read.js';
import { writeThreatDragon } from './threat-dragon-write.js';

/**
 * Threat Dragon v2 codec. Supplying a source preserves unmapped styling, ports
 * and tools, and a mapped value the read narrowed while the model still holds
 * what it read.
 */
export const threatDragonCodec: Codec<typeof threatDragonWireSchema> = {
  wire: threatDragonWireSchema,
  keepsNarrowed: true,
  read: readThreatDragon,
  write: writeThreatDragon,
};
