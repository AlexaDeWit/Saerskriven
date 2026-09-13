import {
  recordsLinkedTo,
  type Mitigation,
  type Model,
  type Threat,
} from '@saerskriven/model';
import type { Divergence } from './divergence.js';
import { inferredMitigationStatus } from './mitigation-text.js';

/**
 * The one mitigation text Threat Dragon holds for `threat`: its own
 * `mitigation` prose, then each mitigation linked to it in register order,
 * separated by a blank line. A mitigation writes its title as a line above
 * its prose, and an empty title or an empty prose is left out.
 */
export function mitigationText(threat: Threat, model: Model): string {
  return textParts(threat, model).join('\n\n');
}

/**
 * What writing the mitigation text of every threat in `written` costs: a
 * text merging more than one part reads back as one record (`narrowed`, once
 * per threat), a mitigation whose status differs from what a read of that
 * threat infers loses it (`unrepresentable`, once per threat), a mitigation
 * written into several threats' texts is `split`, and one written into none
 * is `unrepresentable`.
 */
export function mitigationDivergences(
  model: Model,
  written: readonly Threat[],
): Divergence[] {
  const writtenIds = new Set<string>(written.map((threat) => threat.id));
  return [
    ...written.flatMap((threat) => [
      ...merged(threat, model),
      ...lostStatuses(threat, model),
    ]),
    ...model.mitigations.flatMap((mitigation) =>
      spread(
        mitigation,
        mitigation.threats.filter((id) => writtenIds.has(id)).length,
      ),
    ),
  ];
}

function textParts(threat: Threat, model: Model): string[] {
  return [
    threat.mitigation,
    ...recordsLinkedTo(model.mitigations, threat.id).map(recordText),
  ].filter((part) => part !== '');
}

function recordText({ title, prose }: Mitigation): string {
  return title === '' || prose === ''
    ? `${title}${prose}`
    : `${title}\n${prose}`;
}

function merged(threat: Threat, model: Model): Divergence[] {
  const parts = textParts(threat, model).length;
  return parts > 1
    ? [
        {
          subject: { kind: 'threat', id: threat.id },
          detail: `the ${String(parts)} mitigations written into its one mitigation text, which reads back as one record`,
          reason: 'narrowed',
        },
      ]
    : [];
}

function lostStatuses(threat: Threat, model: Model): Divergence[] {
  const inferred = inferredMitigationStatus(threat.status);
  return recordsLinkedTo(model.mitigations, threat.id)
    .filter((mitigation) => mitigation.status !== inferred)
    .map((mitigation): Divergence => ({
      subject: { kind: 'mitigation', id: mitigation.id },
      detail: `the status "${mitigation.status}" in the text of the threat "${threat.id}", which reads back as "${inferred}"`,
      reason: 'unrepresentable',
    }));
}

function spread(mitigation: Mitigation, threats: number): Divergence[] {
  if (threats === 1) {
    return [];
  }
  return [
    threats === 0
      ? {
          subject: { kind: 'mitigation', id: mitigation.id },
          detail: `the mitigation "${mitigation.title}", which is linked to no threat the format holds`,
          reason: 'unrepresentable',
        }
      : {
          subject: { kind: 'mitigation', id: mitigation.id },
          detail: `the one record, written into the mitigation text of each of the ${String(threats)} threats it is linked to`,
          reason: 'split',
        },
  ];
}
