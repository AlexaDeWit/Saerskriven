import type { SaerskrivenYamlDocument } from '@saerskriven/wire-saerskriven-yaml';
import type { SaerskrivenYamlV2Assumption } from '@saerskriven/wire-saerskriven-yaml-v2';

/**
 * The assumptions of a version 1 document as version 2 holds them: one that
 * links no threat applies to the model, and one that links threats keeps
 * them and does not. Nothing is reported, since the version 1 assumption
 * loses nothing. The version 1 `elements` list has no version 2 key, so the
 * element-link step reports it before this runs.
 */
export function assumptionsWithModelLinks(
  document: SaerskrivenYamlDocument,
): SaerskrivenYamlV2Assumption[] {
  return document.assumptions.map(({ id, prose, status, threats }) => ({
    id,
    prose,
    status,
    threats,
    appliesToModel: threats.length === 0,
  }));
}
