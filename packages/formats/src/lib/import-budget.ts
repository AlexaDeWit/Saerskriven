import type { ReadFailure } from './codec.js';
import { exceededReadLimit, readLimits } from './read-limits.js';

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
      if (!reserve(units)) {
        return '';
      }
      const encoded = parts.map((part) =>
        part.replace(
          /[^A-Za-z0-9]/g,
          (unit) => `_${unit.charCodeAt(0).toString(16)}_`,
        ),
      );
      return `${kind}-${String(parts.length)}-${encoded.join('-')}`;
    },
    reservePath: (path: readonly string[]): boolean =>
      reserve(
        8 + path.reduce((total, segment) => total + 4 * segment.length + 1, 0),
      ),
  };
}
