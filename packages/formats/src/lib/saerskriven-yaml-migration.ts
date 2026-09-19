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
import { z } from 'zod';
import { droppedAssumptionElementLinks } from './saerskriven-yaml-migration-assumption-element-links.js';
import { assumptionsWithModelLinks } from './saerskriven-yaml-migration-assumption-model-links.js';
import type { Divergence } from './divergence.js';
import { withMitigationTextAsRecords } from './saerskriven-yaml-migration-mitigation-text.js';

/**
 * Every released version of Saerskriven YAML, told apart by `formatVersion`.
 * A document stamped with no version this release knows, or with none, is
 * refused at `formatVersion`, and one broken below it is refused at a path
 * into its own version's schema.
 */
export const saerskrivenYamlVersionsSchema = z.discriminatedUnion(
  'formatVersion',
  [saerskrivenYamlWireSchema, saerskrivenYamlV2WireSchema],
);

/** A Saerskriven YAML document of any released version. */
export type SaerskrivenYamlVersionedDocument = z.infer<
  typeof saerskrivenYamlVersionsSchema
>;

/** A document in the current version, and what bringing it there cost. */
export type CurrentSaerskrivenYaml = {
  readonly document: SaerskrivenYamlV2Document;
  readonly divergences: readonly Divergence[];
};

/**
 * A document of any released version in the current one. A version 2
 * document comes back as it is, reporting nothing. A version 1 document goes
 * through two steps: each threat's mitigation text made a record under the
 * one-to-one status rule, and each assumption given the model link
 * {@link assumptionsWithModelLinks} reads. The version 1 `elements` list has
 * no version 2 key, so {@link droppedAssumptionElementLinks} reports each
 * assumption that held one, read from the original document. Statuses carry
 * over one to one.
 */
export function currentSaerskrivenYaml(
  document: SaerskrivenYamlVersionedDocument,
): CurrentSaerskrivenYaml {
  return document.formatVersion === 2
    ? { document, divergences: [] }
    : migratedFromVersion1(document);
}

function migratedFromVersion1(
  document: SaerskrivenYamlDocument,
): CurrentSaerskrivenYaml {
  const stepped = withMitigationTextAsRecords(document);
  return {
    document: {
      formatVersion: 2,
      metadata: stepped.metadata,
      assumptions: assumptionsWithModelLinks(stepped),
      diagrams: stepped.diagrams,
      mitigations: stepped.mitigations,
      threats: stepped.threats.map(withoutMitigationText),
      lastIssuedThreatNumber: stepped.lastIssuedThreatNumber,
    },
    divergences: droppedAssumptionElementLinks(document),
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
