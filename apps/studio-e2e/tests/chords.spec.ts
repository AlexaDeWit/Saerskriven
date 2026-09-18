import { repositoryRoot } from '@saerskriven/model/fixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registeredChords } from '../src/chords.fixtures.js';

const table = readFileSync(
  join(repositoryRoot, 'apps/studio/src/commands/table.ts'),
  'utf8',
);

const asChordCall = (chord: string): string => {
  if (chord === 'ControlOrMeta++') {
    return "character('+', ['Mod'])";
  }
  if (chord === '?' || chord === '+') {
    return `character('${chord}')`;
  }
  if (chord === 'Escape') {
    return 'escapeChord';
  }
  const pressed = chord.split('+');
  const shown = pressed.at(-1) ?? '';
  const key = shown === 'Space' ? ' ' : shown;
  const held = pressed.slice(0, -1);
  if (held.length === 0) {
    return `bare('${key}')`;
  }
  if (held.includes('Control')) {
    return `mod('${key}', 'other')`;
  }
  return held.includes('Shift') ? `modShift('${key}')` : `mod('${key}')`;
};

const asTableSource = (chords: readonly string[]): string =>
  `shortcuts: [${chords.map(asChordCall).join(', ')}],`;

const declaredIds: readonly string[] = table.match(/\bid: '[^']+',/gu) ?? [];

describe('the chords the browser suite presses', () => {
  it('are the chords the table binds, written as the table writes them', () => {
    const adrift = Object.entries(registeredChords).filter(
      ([, chords]) => !table.includes(asTableSource(chords)),
    );

    expect(adrift.map(([id]) => id)).toEqual([]);
  });

  it('name every command the table declares, and no command it does not', () => {
    expect(declaredIds).toHaveLength(Object.keys(registeredChords).length);
    const unknown = Object.keys(registeredChords).filter(
      (id) => !declaredIds.includes(`id: '${id}',`),
    );

    expect(unknown).toEqual([]);
  });
});
