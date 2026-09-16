import {
  recordsLinkedTo,
  type Mitigation,
  type Model,
  type Threat,
} from '@saerskriven/model';
import type { Divergence } from './divergence.js';
import { inferredMitigationStatus } from './mitigation-text.js';

/**
 * The one mitigation text Threat Dragon holds for `threat`: each mitigation
 * linked to it in register order, separated by a blank line. A mitigation
 * writes its title as a line above its prose, and an empty title or an empty
 * prose is left out.
 */
export function mitigationText(threat: Threat, model: Model): string {
  return textParts(threat, model).join('\n\n');
}

/**
 * What writing the mitigation text of every threat in `written` costs, none
 * of it for an unedited read written back. A text that merges several
 * records, or carries a title, reads back as one untitled record and is
 * `narrowed` once per threat. Once per threat, a mitigation with neither
 * title nor prose writes nothing and one whose status differs from what a
 * read infers loses that status, each `unrepresentable`. A mitigation that
 * writes something into several threats' texts is `split`, and one written
 * into none is `unrepresentable`.
 */
export function mitigationDivergences(
  model: Model,
  written: readonly Threat[],
): Divergence[] {
  const writtenIds = new Set<string>(written.map((threat) => threat.id));
  return [
    ...written.flatMap((threat) => [
      ...narrowedText(threat, model),
      ...emptyRecords(threat, model),
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
  return recordsLinkedTo(model.mitigations, threat.id)
    .map(recordText)
    .filter((part) => part !== '');
}

function writesNothing({ title, prose }: Mitigation): boolean {
  return title === '' && prose === '';
}

function recordText({ title, prose }: Mitigation): string {
  return title === '' || prose === ''
    ? `${title}${prose}`
    : `${title}\n${prose}`;
}

function narrowedText(threat: Threat, model: Model): Divergence[] {
  const parts = textParts(threat, model).length;
  const titled = recordsLinkedTo(model.mitigations, threat.id).some(
    ({ title }) => title !== '',
  );
  return parts > 1 || titled
    ? [
        {
          subject: { kind: 'threat', id: threat.id },
          detail:
            parts > 1
              ? `the ${String(parts)} records merged into its one mitigation text, which reads back as one record with no title`
              : 'the mitigation title written into its one mitigation text, which reads back as one record with no title',
          reason: 'narrowed',
        },
      ]
    : [];
}

function emptyRecords(threat: Threat, model: Model): Divergence[] {
  return recordsLinkedTo(model.mitigations, threat.id)
    .filter(writesNothing)
    .map((mitigation): Divergence => ({
      subject: { kind: 'mitigation', id: mitigation.id },
      detail: `the mitigation with no title and no text, which writes nothing into the text of the threat "${threat.id}"`,
      reason: 'unrepresentable',
    }));
}

function lostStatuses(threat: Threat, model: Model): Divergence[] {
  const inferred = inferredMitigationStatus(threat.status);
  return recordsLinkedTo(model.mitigations, threat.id)
    .filter(
      (mitigation) =>
        mitigation.status !== inferred && !writesNothing(mitigation),
    )
    .map((mitigation): Divergence => ({
      subject: { kind: 'mitigation', id: mitigation.id },
      detail: `the status "${mitigation.status}" in the text of the threat "${threat.id}", which reads back as "${inferred}"`,
      reason: 'unrepresentable',
    }));
}

function spread(mitigation: Mitigation, threats: number): Divergence[] {
  if (threats === 1 || (threats > 1 && writesNothing(mitigation))) {
    return [];
  }
  return [
    threats === 0
      ? {
          subject: { kind: 'mitigation', id: mitigation.id },
          detail: `the mitigation "${mitigation.title === '' ? mitigation.id : mitigation.title}", which is linked to no threat the format holds`,
          reason: 'unrepresentable',
        }
      : {
          subject: { kind: 'mitigation', id: mitigation.id },
          detail: `the one record, written into the mitigation text of each of the ${String(threats)} threats it is linked to`,
          reason: 'split',
        },
  ];
}
