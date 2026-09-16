import type { SaerskrivenYamlDocument } from '@saerskriven/wire-saerskriven-yaml';
import { idsHeld, mitigationsFromText } from './mitigation-text.js';
import {
  mitigationStatusesToWire,
  threatStatusesToModel,
} from './saerskriven-yaml-vocabulary.js';

/**
 * A version 1 document with each threat's `mitigation` text moved into a
 * record on the terms of {@link mitigationsFromText}, after the document's
 * own mitigations, with every id the document holds taken, and each threat's
 * text left empty.
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
