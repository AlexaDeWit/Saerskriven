import { repositoryRoot } from '@saerskriven/model/fixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registeredChords } from '../src/chords.fixtures.js';

const registry = readFileSync(
  join(repositoryRoot, 'apps/studio/src/commands/registry.ts'),
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

const asRegistrySource = (chords: readonly string[]): string =>
  `shortcuts: [${chords.map(asChordCall).join(', ')}],`;

const declaredIds: readonly string[] = registry.match(/\bid: '[^']+',/gu) ?? [];

describe('the chords the browser suite presses', () => {
  it('are the chords the registry binds, written as the registry writes them', () => {
    const adrift = Object.entries(registeredChords).filter(
      ([, chords]) => !registry.includes(asRegistrySource(chords)),
    );

    expect(adrift.map(([id]) => id)).toEqual([]);
  });

  it('name every command the registry declares, and no command it does not', () => {
    expect(declaredIds).toHaveLength(Object.keys(registeredChords).length);
    const unknown = Object.keys(registeredChords).filter(
      (id) => !declaredIds.includes(`id: '${id}',`),
    );

    expect(unknown).toEqual([]);
  });
});
