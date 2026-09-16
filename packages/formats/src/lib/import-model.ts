import type { ParseIssue } from '@saerskriven/model';
import type { Divergence } from './divergence.js';
import { importBudget } from './import-budget.js';
import { isRecord } from './records.js';

/**
 * The state one OTM or TM-BOM import accumulates: the text budget, the
 * divergences it reports, the reference problems it finds, and the source
 * fields a mapping used, so every other field is reported by `omitted`.
 */
export function importContext() {
  const budget = importBudget();
  const used = new WeakMap<object, Set<string>>();
  const divergences: Divergence[] = [];
  const issues: ParseIssue[] = [];
  const report = (
    detail: string,
    reason: Divergence['reason'] = 'narrowed',
  ): void => {
    if (budget.failure !== undefined) {
      return;
    }
    divergences.push({ subject: { kind: 'model' }, detail, reason });
  };
  const problem = (
    path: readonly (string | number)[],
    message: string,
  ): void => {
    issues.push({ path: [...path], message, code: 'custom' });
  };
  return {
    text: budget.text,
    id: budget.id,
    reservePath: budget.reservePath,
    get failure() {
      return budget.failure;
    },
    divergences,
    issues,
    report,
    problem,
    fields: <T extends object>(
      value: T,
      keys: readonly (keyof T & string)[],
    ): T => {
      const selected = used.get(value) ?? new Set<string>();
      for (const key of keys) {
        selected.add(key);
      }
      used.set(value, selected);
      return value;
    },
    index: <T>(
      values: readonly T[],
      key: (value: T) => string,
      path: string,
    ): Map<string, T> => indexed(values, key, path, problem),
    omitted: (source: object): void => {
      omittedFields(source, used, report);
    },
  };
}

/** The report and reference checks shared by the two import mappings. */
export type ImportContext = ReturnType<typeof importContext>;

/** The fields an imported element holds whatever its kind, unscoped. */
export function importElement(
  context: ImportContext,
  id: string,
  name: string,
  description = '',
) {
  return {
    id,
    name: context.text([name]),
    description: context.text([description]),
    outOfScope: false,
    reasonOutOfScope: '',
  };
}

/**
 * A mitigation that would link no threat, as one line of the model
 * description with one report line, since no import creates a mitigation
 * without a threat.
 */
export function unlinkedMitigationLine(
  context: ImportContext,
  subject: string,
  parts: readonly string[],
): string {
  context.report(
    `${subject} names no threat and becomes a line of the model description.`,
  );
  return context.text(parts, '');
}

function indexed<T>(
  values: readonly T[],
  key: (value: T) => string,
  path: string,
  problem: (path: readonly (string | number)[], message: string) => void,
): Map<string, T> {
  const result = new Map<string, T>();
  for (const [position, value] of values.entries()) {
    const id = key(value);
    if (result.has(id)) {
      problem([path, position], `Duplicate identifier ${JSON.stringify(id)}`);
    }
    result.set(id, value);
  }
  return result;
}

function omittedFields(
  source: object,
  used: WeakMap<object, Set<string>>,
  report: (detail: string, reason: Divergence['reason']) => void,
): void {
  const pending: { value: unknown; path: readonly string[] }[] = [
    { value: source, path: [] },
  ];
  const visited = new WeakSet();
  while (pending.length > 0) {
    const entry = pending.pop();
    if (
      entry === undefined ||
      typeof entry.value !== 'object' ||
      entry.value === null ||
      visited.has(entry.value)
    ) {
      continue;
    }
    visited.add(entry.value);
    if (Array.isArray(entry.value)) {
      entry.value.forEach((value: unknown, index) =>
        pending.push({ value, path: [...entry.path, String(index)] }),
      );
    } else if (isRecord(entry.value)) {
      const selected = used.get(entry.value);
      for (const [key, value] of Object.entries(entry.value)) {
        const path = [...entry.path, key];
        if (selected?.has(key)) {
          pending.push({ value, path });
        } else {
          report(
            `The source field ${JSON.stringify(path)} is not retained by import.`,
            'unrepresentable',
          );
        }
      }
    }
  }
}
