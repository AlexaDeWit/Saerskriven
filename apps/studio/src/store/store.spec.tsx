import { act, render } from '@testing-library/react';
import { Result } from 'effect';
import { useEffect } from 'react';
import { Action } from './actions.js';
import {
  actorElement,
  addedProcess,
  elementCount,
  foreignSource,
  mainDiagram,
  memoryRestoreMark,
  nativeSource,
  restorableSnapshot,
  sampleModel,
  secondDiagram,
  twoDiagramModel,
} from './store.fixtures.js';
import {
  activeDiagramId,
  holdsUnsavedWork,
  isDirty,
  needsCloseGuard,
} from './selectors.js';
import {
  RecoveryProblem,
  RecoveryStorageFailure,
  type RecoverySnapshot,
  type RecoveryStorage,
  type StoredSnapshot,
} from './recovery-storage.js';
import type { StoreSync, SyncedState } from './sync.js';
import {
  FileLifecycle,
  initialState,
  nameOf,
  placeholderModel,
  StudioFailure,
} from './state.js';
import {
  createModelStore,
  dispatch,
  modelStore,
  useModelStore,
} from './store.js';

const painted: number[] = [];

function ElementCount() {
  const count = useModelStore(elementCount);
  useEffect(() => {
    painted.push(count);
  });
  return <span>{count}</span>;
}

describe('the model store', () => {
  beforeEach(() => {
    modelStore.setState(initialState(sampleModel), true);
    painted.length = 0;
  });

  it('leaves a component alone while a slice it does not read moves', () => {
    render(<ElementCount />);
    expect(painted).toEqual([3]);
    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement] }));
    });
    expect(painted).toEqual([3]);
    act(() => {
      dispatch(addedProcess);
    });
    expect(painted).toEqual([3, 4]);
  });
});

const loaded = (snapshot?: RecoverySnapshot): RecoveryStorage => ({
  load: () => Result.succeed(snapshot),
  replace: () => Result.succeed(undefined),
  clear: () => Result.succeed(undefined),
});

const silent: StoreSync = {
  publish: () => undefined,
  watch: () => () => undefined,
};

function tabs(snapshot?: RecoverySnapshot) {
  const writes = { replaced: 0, cleared: 0 };
  const published: SyncedState[] = [];
  const storage: RecoveryStorage = {
    ...loaded(snapshot),
    replace: () => {
      writes.replaced += 1;
      return Result.succeed(undefined);
    },
    clear: () => {
      writes.cleared += 1;
      return Result.succeed(undefined);
    },
  };
  const sync: StoreSync = {
    ...silent,
    publish: (state) => {
      published.push(state);
    },
  };
  return { storage, sync, writes, published };
}

describe('session recovery', () => {
  it.each([false, true])(
    'restores a session whose dirty status is %s with empty transient state',
    (dirty) => {
      const file = FileLifecycle.Opened({
        name: 'model.json',
        source: foreignSource,
      });
      const runtime = createModelStore(
        loaded(restorableSnapshot(sampleModel, dirty, file)),
        silent,
        placeholderModel,
      );
      const state = runtime.modelStore.getState();

      expect(state.present).toEqual(sampleModel);
      expect(isDirty(state)).toBe(dirty);
      expect(state.file).toEqual(file);
      expect(state.past).toEqual([]);
      expect(state.future).toEqual([]);
      expect(state.selection).toEqual([]);
      expect(state.inlineEditor).toBeUndefined();
      expect(state.lastFailure).toBeUndefined();
      expect(state.recoveryCurrent).toBe(true);
    },
  );

  it('restores the diagram on screen where the restored model holds it', () => {
    const shown = createModelStore(
      loaded(
        restorableSnapshot(
          twoDiagramModel,
          false,
          FileLifecycle.NoFile(),
          secondDiagram,
        ),
      ),
      silent,
    ).modelStore.getState();
    expect(activeDiagramId(shown)).toBe(secondDiagram);

    const stale = createModelStore(
      loaded(
        restorableSnapshot(
          sampleModel,
          false,
          FileLifecycle.NoFile(),
          secondDiagram,
        ),
      ),
      silent,
    ).modelStore.getState();
    expect(stale.activeDiagram).toBeUndefined();
    expect(activeDiagramId(stale)).toBe(mainDiagram);
  });

  it('replaces recovery when the diagram on screen changes', () => {
    let stored: StoredSnapshot | undefined;
    const storage: RecoveryStorage = {
      ...loaded(),
      replace: (snapshot) => {
        stored = snapshot;
        return Result.succeed(undefined);
      },
    };
    const runtime = createModelStore(storage, silent, twoDiagramModel);

    runtime.dispatch(Action.SelectDiagram({ diagramId: secondDiagram }));

    expect(stored?.activeDiagram).toBe(secondDiagram);
    expect(stored?.dirty).toBe(false);
  });

  it('keeps the diagram on screen to this tab, publishing no result for a switch', () => {
    const tab = tabs();
    const runtime = createModelStore(tab.storage, tab.sync, twoDiagramModel);

    runtime.dispatch(Action.SelectDiagram({ diagramId: secondDiagram }));

    expect(tab.writes.replaced).toBe(1);
    expect(tab.published).toEqual([]);
  });

  it('opens the placeholder and reports rejected stored data', () => {
    const storage: RecoveryStorage = {
      ...loaded(),
      load: () =>
        Result.fail(
          RecoveryStorageFailure.Rejected({
            problem: RecoveryProblem.Unsupported(),
          }),
        ),
    };

    const state = createModelStore(storage, silent).modelStore.getState();

    expect(state.present).toBe(placeholderModel);
    expect(state.lastFailure?._tag).toBe('StoredRecoveryRejected');
  });

  it.each([
    RecoveryStorageFailure.Rejected({ problem: RecoveryProblem.Unsupported() }),
    RecoveryStorageFailure.Unavailable({
      problem: RecoveryProblem.Thrown({ reason: 'Storage is off.' }),
    }),
  ])(
    'counts a snapshot it could not read at startup ($_tag) as unsaved work until a write replaces it',
    (failure) => {
      let replacements = 0;
      const storage: RecoveryStorage = {
        ...loaded(),
        load: () => Result.fail(failure),
        replace: () => {
          replacements += 1;
          return replacements === 1
            ? Result.fail(
                RecoveryStorageFailure.Unavailable({
                  problem: RecoveryProblem.Thrown({ reason: 'Quota reached.' }),
                }),
              )
            : Result.succeed(undefined);
        },
      };
      const runtime = createModelStore(storage, silent, sampleModel);
      const unread = (): boolean =>
        runtime.modelStore.getState().recoveryUnread;

      expect(isDirty(runtime.modelStore.getState())).toBe(false);
      expect(holdsUnsavedWork(runtime.modelStore.getState())).toBe(true);
      runtime.dispatch(Action.DismissFailure());
      expect(holdsUnsavedWork(runtime.modelStore.getState())).toBe(true);
      runtime.dispatch(addedProcess);
      expect(unread()).toBe(true);
      runtime.dispatch(Action.Undo());
      expect(unread()).toBe(false);
      expect(holdsUnsavedWork(runtime.modelStore.getState())).toBe(false);
    },
  );

  it('raises the restore mark as it restores a snapshot', () => {
    const mark = memoryRestoreMark();

    const state = createModelStore(
      loaded(restorableSnapshot(sampleModel, true, FileLifecycle.NoFile())),
      silent,
      placeholderModel,
      mark,
    ).modelStore.getState();

    expect(state.present).toEqual(sampleModel);
    expect(mark.raised()).toBe(true);
  });

  it('opens the placeholder over a snapshot whose last restore never finished drawing, leaves it stored, and restores it at the start after', () => {
    const mark = memoryRestoreMark(true);
    const tab = tabs(
      restorableSnapshot(sampleModel, true, FileLifecycle.NoFile()),
    );

    const skipped = createModelStore(
      tab.storage,
      tab.sync,
      placeholderModel,
      mark,
    ).modelStore.getState();

    expect(skipped.present).toBe(placeholderModel);
    expect(skipped.recoveryUnread).toBe(true);
    expect(skipped.lastFailure).toEqual(
      StudioFailure.StoredRecoveryRejected({
        problem: RecoveryProblem.RestoreUnfinished(),
      }),
    );
    expect(mark.raised()).toBe(false);
    expect(tab.writes).toEqual({ replaced: 0, cleared: 0 });

    const next = createModelStore(
      tab.storage,
      tab.sync,
      placeholderModel,
      mark,
    ).modelStore.getState();

    expect(next.present).toEqual(sampleModel);
    expect(next.lastFailure).toBeUndefined();
    expect(mark.raised()).toBe(true);
  });

  it.each([
    ['no snapshot', loaded()],
    [
      'a snapshot it could not read',
      {
        ...loaded(),
        load: () =>
          Result.fail(
            RecoveryStorageFailure.Rejected({
              problem: RecoveryProblem.Unsupported(),
            }),
          ),
      },
    ],
  ])(
    'leaves the restore mark lowered at a start that finds %s',
    (_found, storage) => {
      const mark = memoryRestoreMark();

      createModelStore(storage, silent, placeholderModel, mark);

      expect(mark.raised()).toBe(false);
    },
  );

  it('replaces recovery before publishing a recoverable state change', () => {
    let runtime: ReturnType<typeof createModelStore>;
    let stored: StoredSnapshot | undefined;
    const storage: RecoveryStorage = {
      ...loaded(),
      replace: (snapshot) => {
        expect(runtime.modelStore.getState().present).toBe(sampleModel);
        stored = snapshot;
        return Result.succeed(undefined);
      },
    };
    runtime = createModelStore(storage, silent, sampleModel);

    runtime.dispatch(addedProcess);

    const written = stored?.document;
    expect(
      written?.formatVersion === 2 ? written.diagrams[0].elements : undefined,
    ).toHaveLength(4);
    expect(runtime.modelStore.getState().recoveryCurrent).toBe(true);
  });

  it('does not replace recovery for transient selection state', () => {
    let replacements = 0;
    const storage: RecoveryStorage = {
      ...loaded(),
      replace: () => {
        replacements += 1;
        return Result.succeed(undefined);
      },
    };
    const runtime = createModelStore(storage, silent, sampleModel);

    runtime.dispatch(Action.Select({ elementIds: [actorElement] }));

    expect(replacements).toBe(0);
  });

  it('guards a dirty session after a later recovery write fails', () => {
    let replacements = 0;
    const storage: RecoveryStorage = {
      ...loaded(),
      replace: () => {
        replacements += 1;
        return replacements === 1
          ? Result.succeed(undefined)
          : Result.fail(
              RecoveryStorageFailure.Unavailable({
                problem: RecoveryProblem.Thrown({ reason: 'Quota reached.' }),
              }),
            );
      },
    };
    const runtime = createModelStore(storage, silent, sampleModel);

    runtime.dispatch(addedProcess);
    expect(needsCloseGuard(runtime.modelStore.getState())).toBe(false);
    runtime.dispatch(
      Action.RenameElement({ elementId: actorElement, name: 'Changed' }),
    );

    const state = runtime.modelStore.getState();
    expect(isDirty(state)).toBe(true);
    expect(needsCloseGuard(state)).toBe(true);
    expect(state.lastFailure).toEqual(
      expect.objectContaining({ _tag: 'RecoveryUnavailable' }),
    );
  });

  it('publishes each changed result to the other tabs, and nothing for a transient change', () => {
    const tab = tabs();
    const runtime = createModelStore(tab.storage, tab.sync, sampleModel);

    runtime.dispatch(Action.Select({ elementIds: [actorElement] }));
    runtime.dispatch(addedProcess);
    runtime.dispatch(Action.Undo());

    expect(tab.published.map((state) => state.past.length)).toEqual([1, 0]);
    expect(tab.published[0]?.present).toBe(
      runtime.modelStore.getState().future[0],
    );
    expect(tab.published[1]?.recoveryCurrent).toBe(true);
  });

  it('publishes a result whose recovery write failed, so the other tabs guard it too', () => {
    const tab = tabs();
    tab.storage = {
      ...tab.storage,
      replace: () =>
        Result.fail(
          RecoveryStorageFailure.Unavailable({
            problem: RecoveryProblem.Thrown({ reason: 'Quota reached.' }),
          }),
        ),
    };
    const runtime = createModelStore(tab.storage, tab.sync, sampleModel);

    runtime.dispatch(addedProcess);

    expect(tab.published).toHaveLength(1);
    expect(tab.published[0]?.recoveryCurrent).toBe(false);
  });

  it('publishes a save, which moves the saved point and the file, and a close', () => {
    const tab = tabs();
    const runtime = createModelStore(tab.storage, tab.sync, sampleModel);
    runtime.dispatch(addedProcess);
    const file = FileLifecycle.Opened({
      name: 'model.yaml',
      source: nativeSource,
    });

    runtime.dispatch(
      Action.Saved({ name: 'model.yaml', source: nativeSource }),
    );
    runtime.dispatch(Action.Closed());

    const [, saved, closed] = tab.published;
    expect(saved?.saved).toBe(saved?.present);
    expect(saved?.file).toEqual(file);
    expect(closed?.present).toBe(placeholderModel);
    expect(closed?.file).toEqual(FileLifecycle.NoFile());
    expect(tab.published).toHaveLength(3);
  });

  it('lands a shared link as it lands an import: unsaved, recoverable, named and published', () => {
    const tab = tabs();
    const runtime = createModelStore(tab.storage, tab.sync, placeholderModel);
    const imported = createModelStore(loaded(), silent, placeholderModel);
    const unformatted = {
      model: sampleModel,
      name: 'Shared.yaml',
      divergences: [],
    };

    runtime.dispatch(
      Action.LinkOpened({ model: sampleModel, name: 'Shared.yaml' }),
    );
    imported.dispatch(Action.Imported({ ...unformatted, format: 'otm' }));

    const linked = runtime.modelStore.getState();
    expect(linked.present).toBe(sampleModel);
    expect(isDirty(linked)).toBe(true);
    expect(linked.recoveryCurrent).toBe(true);
    expect(nameOf(linked.file)).toBe('Shared.yaml');
    expect(linked.file).toEqual(imported.modelStore.getState().file);
    expect(tab.writes.replaced).toBe(1);
    expect(tab.published).toHaveLength(1);
    // @ts-expect-error an import names the format it was converted from
    expect(Action.Imported(unformatted)._tag).toBe('Imported');
  });

  it('follows another tab without writing or publishing, since the result is already theirs', () => {
    const tab = tabs();
    const runtime = createModelStore(tab.storage, tab.sync, placeholderModel);
    const file = FileLifecycle.Opened({
      name: 'model.json',
      source: foreignSource,
    });
    const theirs = {
      ...initialState(sampleModel),
      past: [placeholderModel],
      saved: placeholderModel,
      file,
      recoveryCurrent: true,
    };

    runtime.dispatch(Action.Followed({ state: theirs }));

    const state = runtime.modelStore.getState();
    expect(state.present).toBe(sampleModel);
    expect(state.past).toBe(theirs.past);
    expect(isDirty(state)).toBe(true);
    expect(state.file).toEqual(file);
    expect(state.recoveryCurrent).toBe(true);
    expect(tab.writes).toEqual({ replaced: 0, cleared: 0 });
    expect(tab.published).toEqual([]);
  });

  it('clears recovery when the session closes', () => {
    let clears = 0;
    const storage: RecoveryStorage = {
      ...loaded(restorableSnapshot(sampleModel, true, FileLifecycle.NoFile())),
      clear: () => {
        clears += 1;
        return Result.succeed(undefined);
      },
    };
    const runtime = createModelStore(storage, silent);

    runtime.dispatch(Action.Closed());

    expect(clears).toBe(1);
    expect(runtime.modelStore.getState().recoveryCurrent).toBe(false);
  });

  it('keeps the session available until a failed clear succeeds', () => {
    let clears = 0;
    const file = FileLifecycle.Opened({
      name: 'model.json',
      source: foreignSource,
    });
    const storage: RecoveryStorage = {
      ...loaded(restorableSnapshot(sampleModel, true, file)),
      clear: () => {
        clears += 1;
        return clears === 1
          ? Result.fail(
              RecoveryStorageFailure.Unavailable({
                problem: RecoveryProblem.Thrown({ reason: 'Clear failed.' }),
              }),
            )
          : Result.succeed(undefined);
      },
    };
    const runtime = createModelStore(storage, silent);

    expect(runtime.dispatch(Action.Closed())._tag).toBe('Failure');
    const retained = runtime.modelStore.getState();
    expect(retained.present).toEqual(sampleModel);
    expect(retained.file).toEqual(file);
    expect(isDirty(retained)).toBe(true);
    expect(retained.lastFailure?._tag).toBe('RecoveryUnavailable');

    expect(runtime.dispatch(Action.Closed())).toEqual(
      Result.succeed(undefined),
    );
    expect(runtime.modelStore.getState().present).toBe(placeholderModel);
    expect(runtime.modelStore.getState().file).toEqual(FileLifecycle.NoFile());
  });
});
