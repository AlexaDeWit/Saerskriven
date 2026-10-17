import {
  saerskrivenYamlWireSchema,
  type SaerskrivenYamlDocument,
  type SaerskrivenYamlThreat,
} from '@saerskriven/wire-saerskriven-yaml';
import {
  saerskrivenYamlV2WireSchema,
  type SaerskrivenYamlV2Document,
  type SaerskrivenYamlV2Threat,
} from '@saerskriven/wire-saerskriven-yaml-v2';
import {
  saerskrivenYamlV3WireSchema,
  type SaerskrivenYamlV3Document,
} from '@saerskriven/wire-saerskriven-yaml-v3';
import { z } from 'zod';
import { droppedAssumptionElementLinks } from './saerskriven-yaml-migration-assumption-element-links.js';
import { assumptionsWithModelLinks } from './saerskriven-yaml-migration-assumption-model-links.js';
import type { Divergence } from './divergence.js';
import { withMitigationTextAsRecords } from './saerskriven-yaml-migration-mitigation-text.js';
import { withElementsPlaced } from './saerskriven-yaml-migration-placements.js';

/**
 * Every released version of Saerskriven YAML, told apart by `formatVersion`.
 * A document stamped with no version this release knows, or with none, is
 * refused at `formatVersion`, and one broken below it is refused at a path
 * into its own version's schema.
 */
export const saerskrivenYamlVersionsSchema = z.discriminatedUnion(
  'formatVersion',
  [
    saerskrivenYamlWireSchema,
    saerskrivenYamlV2WireSchema,
    saerskrivenYamlV3WireSchema,
  ],
);

/** A Saerskriven YAML document of any released version. */
export type SaerskrivenYamlVersionedDocument = z.infer<
  typeof saerskrivenYamlVersionsSchema
>;

/** A document in the current version, and what bringing it there cost. */
export type CurrentSaerskrivenYaml = {
  readonly document: SaerskrivenYamlV3Document;
  readonly divergences: readonly Divergence[];
};

/**
 * A document of any released version in the current one, version 3, one
 * step at a time. A version 3 document comes back as it is. The step from
 * version 2 places each element on the diagram that drew it
 * ({@link withElementsPlaced}) and reports nothing. The step from version 1
 * makes each threat's mitigation text a record under the one-to-one status
 * rule and gives each assumption the model link
 * {@link assumptionsWithModelLinks} reads. The version 1 `elements` list of
 * an assumption has no later key, so {@link droppedAssumptionElementLinks}
 * reports each assumption that held one, read from the original document.
 * Statuses carry over one to one.
 */
export function currentSaerskrivenYaml(
  document: SaerskrivenYamlVersionedDocument,
): CurrentSaerskrivenYaml {
  if (document.formatVersion === 3) {
    return { document, divergences: [] };
  }
  if (document.formatVersion === 2) {
    return { document: withElementsPlaced(document), divergences: [] };
  }
  return {
    document: withElementsPlaced(version2From(document)),
    divergences: droppedAssumptionElementLinks(document),
  };
}

function version2From(
  document: SaerskrivenYamlDocument,
): SaerskrivenYamlV2Document {
  const stepped = withMitigationTextAsRecords(document);
  return {
    formatVersion: 2,
    metadata: stepped.metadata,
    assumptions: assumptionsWithModelLinks(stepped),
    diagrams: stepped.diagrams,
    mitigations: stepped.mitigations,
    threats: stepped.threats.map(withoutMitigationText),
    lastIssuedThreatNumber: stepped.lastIssuedThreatNumber,
  };
}

function withoutMitigationText(
  threat: SaerskrivenYamlThreat,
): SaerskrivenYamlV2Threat {
  return {
    id: threat.id,
    number: threat.number,
    title: threat.title,
    category: threat.category,
    severity: threat.severity,
    status: threat.status,
    description: threat.description,
    elements: threat.elements,
  };
}
