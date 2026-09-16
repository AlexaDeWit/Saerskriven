import type { Colour, RenderTheme } from '@saerskriven/canvas';
import {
  assumptionStatusSchema,
  mitigationStatusSchema,
  severitySchema,
  threatFlagSchema,
  threatStatusSchema,
} from '@saerskriven/model';
import { z } from 'zod';

/**
 * A badge in the register: its semantic role, apart from the label it reads
 * as. Each kind names the theme section its colour comes from.
 */
export const registerBadgeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('severity'), value: severitySchema }),
  z.object({ kind: z.literal('status'), value: threatStatusSchema }),
  z.object({ kind: z.literal('mitigation'), value: mitigationStatusSchema }),
  z.object({ kind: z.literal('assumption'), value: assumptionStatusSchema }),
  z.object({ kind: z.literal('flag'), value: threatFlagSchema }),
]);

/** The semantic role of one badge in the register. */
export type RegisterBadge = z.infer<typeof registerBadgeSchema>;

/** Every badge kind, which is also the theme section holding its colours. */
export const registerBadgeKinds = registerBadgeSchema.options.map(
  (option) => option.shape.kind.value,
);

/** The colour a theme gives a badge's role, read without its label. */
export function badgeColour(theme: RenderTheme, badge: RegisterBadge): Colour {
  if (badge.kind === 'severity') {
    return theme.severity[badge.value];
  }
  if (badge.kind === 'status') {
    return theme.status[badge.value];
  }
  if (badge.kind === 'mitigation') {
    return theme.mitigation[badge.value];
  }
  if (badge.kind === 'assumption') {
    return theme.assumption[badge.value];
  }
  return theme.flag[badge.value];
}
