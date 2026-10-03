import type { ReadFailure } from './codec.js';
import { exceededReadLimit, readLimits } from './read-limits.js';

/**
 * The kinds of imported record a divergence names by its source id: an OTM
 * threat or mitigation definition, made one record per occurrence, and a
 * TM-BOM control.
 */
export type SourceNamedKind = 'otm-threat' | 'otm-mitigation' | 'tmbom-control';

/**
 * The id an import gives a record of `kind` made from `parts` of its source:
 * the kind, the number of parts, and each part with every character outside
 * `[A-Za-z0-9]` escaped, joined by `-`.
 */
export function importedId(kind: string, parts: readonly string[]): string {
  return `${kind}-${String(parts.length)}-${parts.map(escapedPart).join('-')}`;
}

/**
 * Whether `id` is one {@link importedId} gave a record of `kind` whose first
 * source part is `source`, so a reader finds the records an import made from
 * the source record a divergence names.
 */
export function importedFrom(
  id: string,
  kind: SourceNamedKind,
  source: string,
): boolean {
  const head = `${kind}-`;
  if (!id.startsWith(head)) {
    return false;
  }
  const [count, first, ...rest] = id.slice(head.length).split('-');
  return count === String(rest.length + 1) && first === escapedPart(source);
}

/**
 * One import's `maxImportTextUnits` budget, charged before any text is
 * built. Once a charge fails, `failure` holds the refusal and every later
 * charge yields nothing. `id` escapes every character outside `[A-Za-z0-9]`,
 * so an imported id also serves as a canvas selector.
 */
export function importBudget() {
  let remaining = readLimits.maxImportTextUnits;
  let failure: ReadFailure | undefined;
  const reserve = (units: number): boolean => {
    if (failure !== undefined) {
      return false;
    }
    if (units > remaining) {
      failure = exceededReadLimit(
        'maxImportTextUnits',
        readLimits.maxImportTextUnits - remaining + units,
      );
      return false;
    }
    remaining -= units;
    return true;
  };
  return {
    get failure() {
      return failure;
    },
    text: (parts: readonly string[], separator = '\n\n'): string => {
      if (failure !== undefined) {
        return '';
      }
      const present = parts.filter(Boolean);
      const units =
        present.reduce((total, part) => total + part.length, 0) +
        Math.max(0, present.length - 1) * separator.length;
      return reserve(units) ? present.join(separator) : '';
    },
    id: (kind: string, ...parts: readonly string[]): string => {
      const units =
        kind.length +
        String(parts.length).length +
        2 +
        Math.max(0, parts.length - 1) +
        parts.reduce((total, part) => total + part.length * 6, 0);
      return reserve(units) ? importedId(kind, parts) : '';
    },
    reservePath: (path: readonly string[]): boolean =>
      reserve(
        8 + path.reduce((total, segment) => total + 4 * segment.length + 1, 0),
      ),
  };
}

function escapedPart(part: string): string {
  return part.replace(
    /[^A-Za-z0-9]/g,
    (unit) => `_${unit.charCodeAt(0).toString(16)}_`,
  );
}
