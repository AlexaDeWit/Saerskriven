import type { Model } from '@saerskriven/model';
import { Either } from 'effect';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Action } from './actions.js';
import { developmentModel } from './development-model.js';
import { reduce } from './reducer.js';
import {
  browserRecoveryStorage,
  browserRestoreMark,
  inertRestoreMark,
  RecoveryProblem,
  RecoveryStorageFailure,
  recoverySnapshot,
  restoredState,
  type RecoverySnapshot,
  type RecoveryStorage,
  type RestoreMark,
} from './recovery-storage.js';
import {
  StudioFailure,
  initialState,
  placeholderModel,
  type State,
} from './state.js';
import { browserStoreSync, type StoreSync, type SyncedState } from './sync.js';

type ModelStoreRuntime = {
  readonly modelStore: StoreApi<State>;
  readonly dispatch: (
    action: Action,
  ) => Either.Either<void, RecoveryStorageFailure>;
};

/**
 * Creates a store that restores and replaces one recovery snapshot and
 * publishes every changed result to the other tabs. A followed result is
 * theirs already, so following neither writes nor publishes. A start that
 * restores raises `mark`, and one that finds it raised opens `fallback` and
 * leaves the snapshot alone.
 */
export function createModelStore(
  storage: RecoveryStorage,
  sync: StoreSync,
  fallback = placeholderModel,
  mark = inertRestoreMark,
): ModelStoreRuntime {
  const modelStore = createStore<State>(() =>
    startState(storage, fallback, mark),
  );

  const dispatch = (
    action: Action,
  ): Either.Either<void, RecoveryStorageFailure> => {
    const before = modelStore.getState();
    const reduced = reduce(before, action);
    const followed = action._tag === 'Followed';
    const stored =
      followed || !recoverableChanged(before, reduced)
        ? undefined
        : action._tag === 'Closed'
          ? storage.clear()
          : storage.replace(
              recoverySnapshot(
                reduced.present,
                reduced.present !== reduced.saved,
                reduced.file,
                reduced.activeDiagram,
              ),
            );
    const next = settled(before, reduced, action, stored);
    modelStore.setState(next, true);
    if (!followed && resultChanged(before, next)) {
      sync.publish(syncedState(next));
    }
    return stored ?? Either.right(undefined);
  };

  return { modelStore, dispatch };
}

const runtime = createModelStore(
  browserRecoveryStorage,
  browserStoreSync,
  developmentModel() ?? placeholderModel,
  browserRestoreMark,
);

/** The studio's one vanilla model store. */
export const modelStore = runtime.modelStore;

/** Reduces an action and returns the recovery storage outcome. */
export const dispatch = runtime.dispatch;

/** Dispatches `action` and answers whether the model on screen moved. */
export function changedModel(action: Action): boolean {
  const before = modelStore.getState().present;
  dispatch(action);
  return modelStore.getState().present !== before;
}

/**
 * Runs `changed` whenever an action moves the model on screen, the selection,
 * or the open inline field. Returns the unsubscribe.
 */
export function onCanvasOrPanelChange(changed: () => void): () => void {
  return modelStore.subscribe((state, previous) => {
    if (
      state.present !== previous.present ||
      state.selection !== previous.selection ||
      state.inlineEditor !== previous.inlineEditor
    ) {
      changed();
    }
  });
}

/** Subscribes a component to one store selector. */
export function useModelStore<Selected>(
  select: (state: State) => Selected,
): Selected {
  return useStore(modelStore, select);
}

function startState(
  storage: RecoveryStorage,
  fallback: Model,
  mark: RestoreMark,
): State {
  return storage.load().pipe(
    Either.match({
      onLeft: (failure) => unreadStart(fallback, startupFailure(failure)),
      onRight: (snapshot) =>
        snapshot === undefined
          ? initialState(fallback)
          : restoreStart(snapshot, fallback, mark),
    }),
  );
}

function restoreStart(
  snapshot: RecoverySnapshot,
  fallback: Model,
  mark: RestoreMark,
): State {
  if (mark.raised()) {
    mark.lower();
    return unreadStart(
      fallback,
      StudioFailure.StoredRecoveryRejected({
        problem: RecoveryProblem.RestoreUnfinished(),
      }),
    );
  }
  mark.raise();
  return restoredState(snapshot);
}

function unreadStart(fallback: Model, lastFailure: StudioFailure): State {
  return { ...initialState(fallback), lastFailure, recoveryUnread: true };
}

function settled(
  before: State,
  reduced: State,
  action: Action,
  stored: Either.Either<void, RecoveryStorageFailure> | undefined,
): State {
  if (stored === undefined) {
    return reduced;
  }
  const closing = action._tag === 'Closed';
  if (Either.isLeft(stored)) {
    return {
      ...(closing ? before : reduced),
      recoveryCurrent: closing ? before.recoveryCurrent : false,
      recoveryUnread: before.recoveryUnread,
      lastFailure: StudioFailure.RecoveryUnavailable({
        problem: stored.left.problem,
      }),
    };
  }
  return { ...reduced, recoveryCurrent: !closing, recoveryUnread: false };
}

function syncedState(state: State): SyncedState {
  return {
    present: state.present,
    past: state.past,
    future: state.future,
    saved: state.saved,
    file: state.file,
    recoveryCurrent: state.recoveryCurrent,
  };
}

function startupFailure(failure: RecoveryStorageFailure): StudioFailure {
  return RecoveryStorageFailure.$match(failure, {
    Rejected: ({ problem }) =>
      StudioFailure.StoredRecoveryRejected({ problem }),
    Unavailable: ({ problem }) =>
      StudioFailure.RecoveryUnavailable({ problem }),
  });
}

function recoverableChanged(before: State, after: State): boolean {
  return (
    before.present !== after.present ||
    (before.present !== before.saved) !== (after.present !== after.saved) ||
    before.file !== after.file ||
    before.activeDiagram !== after.activeDiagram
  );
}

function resultChanged(before: State, after: State): boolean {
  return (
    before.present !== after.present ||
    before.past !== after.past ||
    before.future !== after.future ||
    before.saved !== after.saved ||
    before.file !== after.file
  );
}
