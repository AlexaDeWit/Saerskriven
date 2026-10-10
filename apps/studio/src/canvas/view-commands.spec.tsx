import { CommandSurfaceProvider } from '../commands/binding.js';
import { CommandButton } from '../commands/command-button.js';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { currentSnap, useSnap } from './snap.js';
import { ReactFlow } from '@xyflow/react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  actorElement,
  nativeSource,
  sampleModel,
  secondDiagram,
  twoDiagramModel,
} from '../store/store.fixtures.js';
import { canvasModel, openCanvas, requestFlow } from './canvas.fixtures.js';
import { FitOnOpen, useViewCommands } from './view-commands.js';
import { unmeasuredCardBottom } from './viewport.js';

const unfitted = 'transform: translate(0px, 0px) scale(1)';

const transform = (): string =>
  document.querySelector('.react-flow__viewport')?.getAttribute('style') ?? '';

const Harness = ({ cardBottom }: { readonly cardBottom?: number }) => (
  <ReactFlow edges={[]} nodes={[]}>
    <FitOnOpen cardBottom={cardBottom} />
  </ReactFlow>
);

const movedFrom = async (before: string): Promise<string> => {
  await waitFor(() => {
    expect(transform()).not.toBe(before);
  });
  return transform();
};

const fitted = async (): Promise<string> => {
  await waitFor(() => {
    expect(transform()).not.toBe(unfitted);
  });
  return transform();
};

function ViewControls({
  cover = 0,
  cardBottom = 0,
}: {
  readonly cover?: number;
  readonly cardBottom?: number;
}) {
  const snapping = useSnap();
  const view = useViewCommands(cover, cardBottom);
  return (
    <CommandSurfaceProvider surface={{ ...recordingSurface().surface, view }}>
      <CommandButton command="fit-selection" />
      <CommandButton command="fit-to-view" />
      <CommandButton command="reset-zoom" />
      <CommandButton command="zoom-in" />
      <CommandButton command="zoom-out" />
      <CommandButton command="snap-to-grid" />
      <span data-testid="snap-state">{snapping ? 'on' : 'off'}</span>
    </CommandSurfaceProvider>
  );
}

describe('FitOnOpen', () => {
  beforeEach(() => {
    modelStore.setState(initialState(canvasModel), true);
  });

  it('fits the viewport to the model the studio opened on', async () => {
    render(<Harness />);

    expect(await fitted()).not.toBe(unfitted);
  });

  it('waits for the card to be measured, then fits below it, lower than it fits with no card', async () => {
    const { rerender, unmount } = render(
      <Harness cardBottom={unmeasuredCardBottom} />,
    );
    const waiting = transform();
    await act(() => new Promise((settle) => setTimeout(settle, 50)));
    expect(transform()).toBe(waiting);

    rerender(<Harness cardBottom={120} />);
    const below = await movedFrom(waiting);
    unmount();
    modelStore.setState(initialState(canvasModel), true);
    render(<Harness />);

    expect(await movedFrom(waiting)).not.toBe(below);
  });

  it('fits again for a file opened over the model on screen', async () => {
    render(<Harness />);
    const first = await fitted();

    act(() => {
      dispatch(
        Action.Opened({
          model: sampleModel,
          name: 'other.yaml',
          source: nativeSource,
          divergences: [],
        }),
      );
    });

    await waitFor(() => {
      expect(transform()).not.toBe(first);
    });
  });

  it('fits again for a diagram switched to, edited model or not', async () => {
    modelStore.setState(initialState(twoDiagramModel), true);
    render(<Harness />);
    const first = await fitted();

    act(() => {
      dispatch(Action.SelectDiagram({ diagramId: secondDiagram }));
    });

    await waitFor(() => {
      expect(transform()).not.toBe(first);
    });
  });

  it('leaves the viewport where it is for an edit', async () => {
    render(<Harness />);
    const first = await fitted();

    act(() => {
      dispatch(
        Action.MoveElement({
          elementId: actorElement,
          offset: { x: 400, y: 400 },
          decimals: undefined,
        }),
      );
    });

    expect(transform()).toBe(first);
  });
});

const controlsUnder = (cardBottom: number) => (
  <ReactFlow width={1000} height={600} edges={[]} nodes={[]}>
    <ViewControls cardBottom={cardBottom} />
  </ReactFlow>
);

describe('useViewCommands', () => {
  it('fits a selected flow and resets zoom without editing the document or its history', async () => {
    openCanvas([requestFlow]);
    const before = modelStore.getState();
    render(
      <ReactFlow width={800} height={600} edges={[]} nodes={[]}>
        <ViewControls />
      </ReactFlow>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fit selection' }));
    const selected = await fitted();
    fireEvent.click(screen.getByRole('button', { name: 'Fit to view' }));
    await waitFor(() => {
      expect(transform()).not.toBe(selected);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom to 100%' }));
    await waitFor(() => {
      expect(transform()).toContain('scale(1)');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    await waitFor(() => {
      expect(transform()).not.toContain('scale(1)');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    const snapping = currentSnap();
    fireEvent.click(screen.getByRole('button', { name: 'Snap to grid' }));
    expect(currentSnap()).toBe(!snapping);
    fireEvent.click(screen.getByRole('button', { name: 'Snap to grid' }));
    expect(currentSnap()).toBe(snapping);
    expect(modelStore.getState()).toBe(before);
    act(() => {
      dispatch(Action.Select({ elementIds: [] }));
    });
    const at = transform();
    fireEvent.click(screen.getByRole('button', { name: 'Fit selection' }));
    expect(transform()).toBe(at);
  });

  it('refits the selection when pane coverage changes without changing the document', async () => {
    openCanvas([requestFlow]);
    const before = modelStore.getState();
    const { rerender } = render(
      <ReactFlow width={1000} height={600} edges={[]} nodes={[]}>
        <ViewControls cover={100} />
      </ReactFlow>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fit selection' }));
    const narrow = await fitted();
    rerender(
      <ReactFlow width={1000} height={600} edges={[]} nodes={[]}>
        <ViewControls cover={200} />
      </ReactFlow>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Fit selection' }));
    await waitFor(() => {
      expect(transform()).not.toBe(narrow);
    });
    expect(modelStore.getState()).toBe(before);
  });

  it('refits the selection and the diagram when the card grows, without changing the document', async () => {
    openCanvas([requestFlow]);
    const before = modelStore.getState();
    const { rerender } = render(controlsUnder(97));
    fireEvent.click(screen.getByRole('button', { name: 'Fit selection' }));
    const selection = await fitted();
    fireEvent.click(screen.getByRole('button', { name: 'Fit to view' }));
    await waitFor(() => {
      expect(transform()).not.toBe(selection);
    });
    const diagram = transform();

    rerender(controlsUnder(138));
    fireEvent.click(screen.getByRole('button', { name: 'Fit selection' }));
    await waitFor(() => {
      expect(transform()).not.toBe(diagram);
    });
    expect(transform()).not.toBe(selection);
    const lowered = transform();
    fireEvent.click(screen.getByRole('button', { name: 'Fit to view' }));
    await waitFor(() => {
      expect(transform()).not.toBe(lowered);
    });
    expect(transform()).not.toBe(diagram);
    expect(modelStore.getState()).toBe(before);
  });
});
