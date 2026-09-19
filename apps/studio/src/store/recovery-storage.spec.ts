import { saerskrivenYamlCodec } from '@saerskriven/formats';
import type { DiagramId, Model } from '@saerskriven/model';
import { committedText } from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import { studioVersion } from '../version.js';
import { FileLifecycle, type RetainedSource } from './state.js';
import {
  foreignSource,
  nativeSource,
  sampleModel,
  secondDiagram,
  twoDiagramModel,
} from './store.fixtures.js';
import {
  localRecoveryStorage,
  recoverySnapshot,
  recoveryStorageKey,
  RecoveryProblem,
  RecoveryStorageFailure,
} from './recovery-storage.js';

const opened = (source: RetainedSource = foreignSource): FileLifecycle =>
  FileLifecycle.Opened({ name: 'model.json', source });

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    backend: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    },
  };
}

function loadStored(raw: string) {
  const memory = memoryStorage();
  memory.values.set(recoveryStorageKey, raw);
  return localRecoveryStorage(() => memory.backend).load();
}

const rejectionOf = (raw: string): RecoveryProblem => {
  const loaded = loadStored(raw);
  if (Either.isRight(loaded)) {
    throw new Error('The stored snapshot loaded, and this expects a refusal');
  }
  return loaded.left.problem;
};

const expectedRestore = (
  present: Model,
  dirty: boolean,
  file: FileLifecycle,
  activeDiagram?: DiagramId,
) => ({
  version: 2,
  writtenBy: { studioVersion },
  dirty,
  file,
  activeDiagram,
  present,
});

const snapshotBeforeVersion2 = committedText('studio/recovery-v0.4.0.json');

const version1Snapshot = JSON.stringify({
  version: 1,
  present: sampleModel,
  dirty: false,
  file: { _tag: 'NoFile' },
});

const current = recoverySnapshot(sampleModel, false, FileLifecycle.NoFile());

describe('local recovery storage', () => {
  it('loads nothing when the namespaced key is absent', () => {
    const memory = memoryStorage();
    const storage = localRecoveryStorage(() => memory.backend);

    expect(storage.load()).toEqual(Either.right(undefined));
  });

  it('replaces the one versioned snapshot and gives the model back on load', () => {
    const memory = memoryStorage();
    const storage = localRecoveryStorage(() => memory.backend);
    const first = recoverySnapshot(sampleModel, false, opened());
    const latest = recoverySnapshot(sampleModel, true, opened(nativeSource));

    expect(Either.isRight(storage.replace(first))).toBe(true);
    expect(storage.load()).toEqual(
      Either.right(expectedRestore(sampleModel, false, opened())),
    );
    expect(Either.isRight(storage.replace(latest))).toBe(true);

    const raw = memory.values.get(recoveryStorageKey) ?? '';
    expect(JSON.parse(raw)).toMatchObject({
      version: 2,
      dirty: true,
      writtenBy: { studioVersion },
    });
    expect(raw).not.toContain('"past"');
    expect(raw).not.toContain('"future"');
    expect(raw).not.toContain('"selection"');
    expect(raw).not.toContain('"renaming"');
    expect(raw).not.toContain('"lastFailure"');
    expect(storage.load()).toEqual(
      Either.right(expectedRestore(sampleModel, true, opened(nativeSource))),
    );
  });

  it('keeps the diagram on screen, and loads a snapshot written before it was kept', () => {
    const memory = memoryStorage();
    const storage = localRecoveryStorage(() => memory.backend);
    const shown = recoverySnapshot(
      twoDiagramModel,
      false,
      opened(),
      secondDiagram,
    );

    expect(Either.isRight(storage.replace(shown))).toBe(true);
    expect(storage.load()).toEqual(
      Either.right(
        expectedRestore(twoDiagramModel, false, opened(), secondDiagram),
      ),
    );

    storage.replace(recoverySnapshot(twoDiagramModel, false, opened()));
    const earlier = storage.load();
    expect(Either.isRight(earlier)).toBe(true);
    expect(Either.getOrThrow(earlier)?.activeDiagram).toBeUndefined();
  });

  it('restores a snapshot whose document and retained source are version 1, migrated, with its dirty flag, file and diagram', () => {
    const snapshot = Either.getOrThrow(loadStored(snapshotBeforeVersion2));

    expect(snapshot?.dirty).toBe(true);
    expect(snapshot?.activeDiagram).toBe(secondDiagram);
    expect(snapshot?.present.mitigations).toEqual([
      expect.objectContaining({
        status: 'implemented',
        threats: ['threat-spoofed-reader'],
      }),
      expect.objectContaining({
        status: 'proposed',
        threats: ['threat-tampered-studio'],
      }),
    ]);
    expect(
      snapshot?.present.assumptions.map(({ id, threats, appliesToModel }) => ({
        id,
        threats,
        appliesToModel,
      })),
    ).toEqual([
      {
        id: 'assumption-signed-in',
        threats: ['threat-spoofed-reader'],
        appliesToModel: false,
      },
      { id: 'assumption-hand-kept', threats: [], appliesToModel: true },
    ]);
    const file = snapshot?.file;
    expect(file?._tag).toBe('Opened');
    expect(file?._tag === 'Opened' ? file.name : undefined).toBe('model.yaml');
    const source = file?._tag === 'Opened' ? file.source : undefined;
    expect(source?.format).toBe('saerskriven-yaml');
    expect(source?.document).toEqual(
      saerskrivenYamlCodec.wire.parse(source?.document),
    );
    expect(source?.document).toMatchObject({ formatVersion: 2 });
  });

  it('restores a version 2 snapshot, keeping the model link of an assumption that links threats', () => {
    const memory = memoryStorage();
    memory.values.set(recoveryStorageKey, snapshotBeforeVersion2);
    const storage = localRecoveryStorage(() => memory.backend);
    const earlier = Either.getOrThrow(storage.load());
    const present = {
      ...(earlier?.present ?? sampleModel),
      assumptions: (earlier?.present ?? sampleModel).assumptions.map(
        (assumption) => ({ ...assumption, appliesToModel: true }),
      ),
    };
    const source = Either.getOrThrow(
      saerskrivenYamlCodec.read(saerskrivenYamlCodec.write(present).output),
    ).source;
    const file = FileLifecycle.Opened({
      name: 'model.yaml',
      source: { format: 'saerskriven-yaml', document: source },
    });
    storage.replace(recoverySnapshot(present, true, file, secondDiagram));

    expect(storage.load()).toEqual(
      Either.right(expectedRestore(present, true, file, secondDiagram)),
    );
    const restored = Either.getOrThrow(storage.load());
    expect(restored?.dirty).toBe(true);
    expect(restored?.activeDiagram).toBe(secondDiagram);
    expect(restored?.file).toMatchObject({
      _tag: 'Opened',
      name: 'model.yaml',
    });
    expect(
      restored?.present.assumptions.find(
        ({ id }) => id === 'assumption-signed-in',
      ),
    ).toMatchObject({
      threats: ['threat-spoofed-reader'],
      appliesToModel: true,
    });
  });

  it('rejects a version 1 snapshot, saying an earlier release wrote it', () => {
    const older = rejectionOf(version1Snapshot);

    expect(loadStored(version1Snapshot)).toEqual(
      Either.left(RecoveryStorageFailure.Rejected({ problem: older })),
    );
    expect(older).toEqual(
      RecoveryProblem.EarlierRelease({ writer: undefined }),
    );
    expect(rejectionOf('{')).toMatchObject({ _tag: 'Thrown' });
    expect(rejectionOf(JSON.stringify({ ...current, version: 3 }))).toEqual(
      RecoveryProblem.Unsupported(),
    );
  });

  it.each([
    ['malformed JSON', '{'],
    [
      'an unsupported later version',
      JSON.stringify({ ...current, version: 3 }),
    ],
    [
      'a document the model refuses',
      JSON.stringify({
        ...current,
        document: {
          ...current.document,
          threats: current.document.threats.map((threat) => ({
            ...threat,
            elements: ['element-missing'],
          })),
        },
      }),
    ],
    ['an invalid document', JSON.stringify({ ...current, document: {} })],
    [
      'an invalid retained source',
      JSON.stringify({
        ...current,
        file: {
          _tag: 'Opened',
          name: 'model.json',
          source: { format: 'threat-dragon', document: {} },
        },
      }),
    ],
  ])('rejects %s without throwing', (_case, raw) => {
    expect(loadStored(raw)).toEqual(
      Either.left(expect.objectContaining({ _tag: 'Rejected' })),
    );
  });

  it('rejects a snapshot with more invalid entries than zod 4.6.2 gathers on V8 as invalid', () => {
    const flooded = JSON.stringify({
      ...current,
      document: {
        ...current.document,
        threats: [{ elements: Array.from({ length: 135_000 }, () => 1) }],
      },
    });

    expect(rejectionOf(flooded)).toEqual(RecoveryProblem.InvalidSnapshot());
  });

  it('reports disabled storage for load, replace, and clear', () => {
    const refused = localRecoveryStorage(() => {
      throw new Error('storage disabled');
    });
    const snapshot = recoverySnapshot(sampleModel, true, opened());

    for (const outcome of [
      refused.load(),
      refused.replace(snapshot),
      refused.clear(),
    ]) {
      expect(outcome).toEqual(
        Either.left(
          RecoveryStorageFailure.Unavailable({
            problem: RecoveryProblem.Thrown({ reason: 'storage disabled' }),
          }),
        ),
      );
    }
  });

  it('clears the current snapshot', () => {
    const memory = memoryStorage();
    const storage = localRecoveryStorage(() => memory.backend);
    storage.replace(recoverySnapshot(sampleModel, true, opened()));

    expect(Either.isRight(storage.clear())).toBe(true);
    expect(memory.values.has(recoveryStorageKey)).toBe(false);
  });
});
