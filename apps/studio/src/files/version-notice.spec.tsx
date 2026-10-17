import { placedOnto, placementIn } from '@saerskriven/model/fixtures';
import type { Model } from '@saerskriven/model';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { FileLifecycle, initialState, type State } from '../store/state.js';
import {
  actorElement,
  foreignSource,
  twoDiagramModel,
} from '../store/store.fixtures.js';
import { modelStore } from '../store/store.js';
import { useFileSession } from './file-commands.js';
import { FileReports } from './file-reports.js';
import { specBridge } from './files.fixtures.js';
import { versionNoticeAfter } from './version-notice.js';

const shared = placedOnto(
  twoDiagramModel,
  [placementIn(twoDiagramModel, actorElement)],
  1,
);

const sharedAgain: Model = {
  ...shared,
  metadata: { ...shared.metadata, title: 'Renamed' },
};

const at = (present: Model): State => initialState(present);

const editedTo = (state: State, present: Model): State => ({
  ...state,
  present,
  past: [...state.past, state.present],
  future: [],
});

describe('the version report', () => {
  it.each([
    {
      change: 'an edit that shares an element raises it',
      shown: false,
      previous: at(twoDiagramModel),
      next: editedTo(at(twoDiagramModel), shared),
      after: true,
    },
    {
      change: 'an edit that keeps the model at version 3 keeps it',
      shown: true,
      previous: at(shared),
      next: editedTo(at(shared), sharedAgain),
      after: true,
    },
    {
      change: 'an edit at version 3 does not raise it',
      shown: false,
      previous: at(shared),
      next: editedTo(at(shared), sharedAgain),
      after: false,
    },
    {
      change: 'an edit back to version 2 puts it away',
      shown: true,
      previous: at(shared),
      next: editedTo(at(shared), twoDiagramModel),
      after: false,
    },
    {
      change: 'an undo puts it away',
      shown: true,
      previous: editedTo(at(twoDiagramModel), shared),
      next: at(twoDiagramModel),
      after: false,
    },
    {
      change: 'opening a model at version 3 does not raise it',
      shown: false,
      previous: at(twoDiagramModel),
      next: at(shared),
      after: false,
    },
    {
      change: 'a change that leaves the model alone keeps it',
      shown: true,
      previous: at(shared),
      next: { ...at(shared), selection: [actorElement] },
      after: true,
    },
    {
      change: 'an edit of a Threat Dragon file does not raise it',
      shown: false,
      previous: {
        ...at(twoDiagramModel),
        file: FileLifecycle.Opened({
          name: 'model.json',
          source: foreignSource,
        }),
      },
      next: {
        ...editedTo(at(twoDiagramModel), shared),
        file: FileLifecycle.Opened({
          name: 'model.json',
          source: foreignSource,
        }),
      },
      after: false,
    },
  ])('$change', ({ shown, previous, next, after }) => {
    expect(versionNoticeAfter(shown, previous, next)).toBe(after);
  });
});

function Reports() {
  const session = useFileSession(specBridge());
  return <FileReports session={session} />;
}

describe('the version report under the chrome card', () => {
  beforeEach(() => {
    modelStore.setState(at(twoDiagramModel), true);
  });

  it('shows at the edit that moves the model to version 3, until Dismiss', () => {
    render(<Reports />);
    expect(screen.queryByTestId('version-report')).toBeNull();

    act(() => {
      modelStore.setState(editedTo(modelStore.getState(), shared), true);
    });
    expect(screen.queryByTestId('version-report')).not.toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss version report' }),
    );
    expect(screen.queryByTestId('version-report')).toBeNull();
  });
});
