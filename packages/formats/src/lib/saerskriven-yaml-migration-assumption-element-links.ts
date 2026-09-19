import { assumptionIdSchema } from '@saerskriven/model';
import type { SaerskrivenYamlDocument } from '@saerskriven/wire-saerskriven-yaml';
import type { Divergence } from './divergence.js';

/**
 * One `narrowed` divergence for each assumption of a version 1 document
 * whose `elements` list held an id. An assumption whose id the model does
 * not accept is skipped, since a read of that document refuses it.
 */
export function droppedAssumptionElementLinks(
  document: SaerskrivenYamlDocument,
): Divergence[] {
  return document.assumptions.flatMap((assumption): Divergence[] => {
    const id = assumptionIdSchema.safeParse(assumption.id);
    return assumption.elements.length === 0 || !id.success
      ? []
      : [
          {
            subject: { kind: 'assumption', id: id.data },
            detail: { code: 'assumption-element-links-dropped' },
            reason: 'narrowed',
          },
        ];
  });
}
