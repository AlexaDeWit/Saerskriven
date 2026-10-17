import {
  writtenSaerskrivenYamlVersion,
  type DetectedRead,
} from '@saerskriven/formats';
import { Either } from 'effect';
import { describeDivergences, readModel } from './input.js';
import { lines, succeeded, type CommandOutcome } from './outcome.js';

/**
 * `saer validate <file>`: the file read as whichever format claims its
 * content, reported as one line naming that format, the version a save of a
 * Saerskriven YAML model writes, and what the model holds. The file name is
 * never consulted, so a Saerskriven model saved as `.json` reads as well as
 * one saved as `.yaml`.
 */
export function validate(file: string): CommandOutcome {
  return Either.match(readModel(file), {
    onLeft: (outcome) => outcome,
    onRight: (read) =>
      succeeded(lines(summaryOf(read)), describeDivergences(read.divergences)),
  });
}

function summaryOf(read: DetectedRead): string {
  const counts = [
    counted(read.model.diagrams.length, 'diagram'),
    counted(read.model.elements.length, 'element'),
    counted(read.model.threats.length, 'threat'),
  ];
  return `${formatOf(read)}: ${counts.join(', ')}`;
}

function formatOf(read: DetectedRead): string {
  return read.format === 'saerskriven-yaml'
    ? `${read.format} (saves as version ${String(writtenSaerskrivenYamlVersion(read.model))})`
    : read.format;
}

function counted(total: number, noun: string): string {
  return `${String(total)} ${noun}${total === 1 ? '' : 's'}`;
}
