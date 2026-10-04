import {
  isEmptyName,
  recordsLinkedTo,
  type Mitigation,
  type Model,
  type Threat,
} from '@saerskriven/model';
import type { Divergence } from './divergence.js';
import { inferredMitigationStatus } from './mitigation-text.js';

/**
 * Linked records in register order, separated by a blank line. A title
 * precedes its prose on a line of its own. Only exact empty strings are omitted.
 */
export function mitigationText(threat: Threat, model: Model): string {
  return textParts(threat, model).join('\n\n');
}

/**
 * Losses from flattening records into threat text: merged titles or records,
 * empty records, changed statuses, and records split or left unlinked.
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
              ? {
                  code: 'mitigation-records-merged',
                  parameters: { count: parts },
                }
              : { code: 'mitigation-title-merged' },
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
      detail: {
        code: 'mitigation-empty-dropped',
        parameters: { threat: threat.id },
      },
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
      detail: {
        code: 'mitigation-status-dropped',
        parameters: {
          status: mitigation.status,
          threat: threat.id,
          inferred,
        },
      },
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
          detail: {
            code: 'mitigation-unlinked',
            parameters: {
              name: isEmptyName(mitigation.title)
                ? mitigation.id
                : mitigation.title,
            },
          },
          reason: 'unrepresentable',
        }
      : {
          subject: { kind: 'mitigation', id: mitigation.id },
          detail: {
            code: 'mitigation-split-across-threats',
            parameters: { count: threats },
          },
          reason: 'split',
        },
  ];
}
