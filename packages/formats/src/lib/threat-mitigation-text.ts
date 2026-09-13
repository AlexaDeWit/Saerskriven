import type { SaerskrivenYamlDocument } from '@saerskriven/wire-saerskriven-yaml';
import { mitigationsFromText } from './mitigation-text.js';
import {
  mitigationStatusesToWire,
  threatStatusesToModel,
} from './saerskriven-yaml-vocabulary.js';

/**
 * A version 1 document with each threat's `mitigation` text moved into a
 * mitigation record, on the terms of {@link mitigationsFromText}, and every
 * threat's text left empty. The records follow the document's own
 * mitigations, and every id the document holds is taken, so a record the
 * file already has keeps its id. A document whose threats hold
 * no text comes back with the same content.
 */
export function withMitigationTextAsRecords(
  document: SaerskrivenYamlDocument,
): SaerskrivenYamlDocument {
  const records = mitigationsFromText(
    document.threats.map((threat) => ({
      id: threat.id,
      number: threat.number,
      status: threatStatusesToModel[threat.status],
      text: threat.mitigation,
    })),
    idsHeld(document),
  );
  return {
    ...document,
    threats: document.threats.map((threat) => ({ ...threat, mitigation: '' })),
    mitigations: [
      ...document.mitigations,
      ...records.map((record) => ({
        ...record,
        status: mitigationStatusesToWire[record.status],
      })),
    ],
  };
}

function idsHeld(document: SaerskrivenYamlDocument): string[] {
  return [
    ...document.diagrams.flatMap((diagram) => [
      diagram.id,
      ...diagram.elements.map((element) => element.id),
    ]),
    ...document.threats.map((threat) => threat.id),
    ...document.mitigations.map((mitigation) => mitigation.id),
    ...document.assumptions.map((assumption) => assumption.id),
  ];
}
