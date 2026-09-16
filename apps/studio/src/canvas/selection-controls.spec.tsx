import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { elementIn } from '@saerskriven/model/fixtures';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  SelectionControls,
  FlowEndpointCommands,
} from './selection-controls.js';
import { commandById, runCommand } from '../commands/registry.js';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { selectTool } from './tools.js';
import { currentAnnouncement } from './announcements.js';
import {
  actorElement,
  mainDiagram,
  newProcess,
  sampleModel,
} from '../store/store.fixtures.js';
import { canvasModel, openCanvas, requestFlow } from './canvas.fixtures.js';

const flowOf = () =>
  modelStore
    .getState()
    .present.diagrams[0].elements.find((element) => element.kind === 'flow');

beforeEach(() => {
  openCanvas([actorElement]);
});

it('holds geometry drafts until Apply and records position plus size as one edit', async () => {
  render(<SelectionControls />);
  act(() => {
    runCommand(commandById('edit-geometry'), recordingSurface().surface);
  });
  await waitFor(() => {
    expect(document.activeElement).toBe(
      screen.getByRole('spinbutton', { name: 'X' }),
    );
  });
  fireEvent.click(screen.getByRole('button', { name: 'Increase X' }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Height' }), {
    target: { value: '90' },
  });
  expect(modelStore.getState().present).toBe(canvasModel);
  fireEvent.click(screen.getByRole('button', { name: 'Apply geometry' }));
  expect(modelStore.getState().past).toEqual([canvasModel]);
  expect(elementIn(modelStore.getState().present, actorElement)).toMatchObject({
    position: { x: 1 },
    size: { height: 90 },
  });
  expect(
    screen.queryByRole('region', { name: 'Position and size' }),
  ).toBeNull();
});

it('retains invalid dimensions and cancels by Escape without history', () => {
  render(<SelectionControls />);
  act(() => {
    runCommand(commandById('edit-geometry'), recordingSurface().surface);
  });
  const width = screen.getByRole('spinbutton', { name: 'Width' });
  fireEvent.change(width, { target: { value: '-2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply geometry' }));
  expect(modelStore.getState().present).toBe(canvasModel);
  expect(currentAnnouncement().message).toContain('positive');
  width.focus();
  fireEvent.keyDown(width, { key: 'Escape' });
  expect(screen.queryByRole('region')).toBeNull();
  expect(modelStore.getState().past).toEqual([]);
});

it('moves a multi-selection by one offset and invalidates a draft on tool changes', () => {
  openCanvas(
    sampleModel.diagrams[0].elements.map((element) => element.id),
    sampleModel,
  );
  render(<SelectionControls />);
  act(() => {
    runCommand(commandById('edit-geometry'), recordingSurface().surface);
  });
  expect(screen.queryByRole('spinbutton', { name: 'Width' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Decrease Y' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply geometry' }));
  expect(modelStore.getState().present.diagrams[0].elements).toEqual(
    sampleModel.diagrams[0].elements.map((element) =>
      'position' in element
        ? {
            ...element,
            position: { ...element.position, y: element.position.y - 1 },
          }
        : element,
    ),
  );
  expect(modelStore.getState().past).toEqual([sampleModel]);
  act(() => {
    runCommand(commandById('edit-geometry'), recordingSurface().surface);
    selectTool('hand');
  });
  expect(screen.queryByRole('region')).toBeNull();
});

it('changes either endpoint with a chooser and keeps cancelling out of history', () => {
  dispatch(
    Action.AddElement({
      diagramId: mainDiagram,
      element: newProcess('extra-node', 'Extra'),
    }),
  );
  const base = modelStore.getState().present;
  const flow = base.diagrams[0].elements.find(
    (element) => element.kind === 'flow',
  );
  if (flow === undefined) {
    throw new Error('The fixture has no flow.');
  }
  modelStore.setState({ ...initialState(base), selection: [flow.id] }, true);
  render(
    <>
      <SelectionControls />
      <FlowEndpointCommands />
    </>,
  );
  expect(
    screen.getByRole('button', { name: 'Change flow source' }),
  ).toBeDefined();
  act(() => {
    runCommand(commandById('reconnect-source'), recordingSurface().surface);
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Source' }), {
    target: { value: 'extra-node' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply endpoint' }));
  expect(
    modelStore
      .getState()
      .present.diagrams[0].elements.find((element) => element.id === flow.id),
  ).toMatchObject({
    source: { kind: 'attached', element: 'extra-node' },
  });
  act(() => {
    runCommand(commandById('reconnect-target'), recordingSurface().surface);
  });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(modelStore.getState().past).toEqual([base]);
});

it('reports a flow-only geometry selection and ignores editor requests during placement', () => {
  openCanvas([requestFlow]);
  render(<SelectionControls />);
  act(() => {
    runCommand(commandById('edit-geometry'), recordingSurface().surface);
  });
  expect(screen.queryByRole('spinbutton')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  act(() => {
    selectTool('actor');
    runCommand(commandById('edit-geometry'), recordingSurface().surface);
  });
  expect(screen.queryByRole('region')).toBeNull();
});

it('pins the chosen endpoint to a side, and releases it, through the endpoint editor', () => {
  openCanvas([requestFlow]);
  render(<SelectionControls />);
  act(() => {
    runCommand(commandById('reconnect-source'), recordingSurface().surface);
  });
  const side = screen.getByRole<HTMLSelectElement>('combobox', {
    name: 'Side',
  });
  expect(side.value).toBe('');
  fireEvent.change(side, { target: { value: 'bottom' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply endpoint' }));
  expect(flowOf()).toMatchObject({
    source: { kind: 'attached', element: actorElement, side: 'bottom' },
  });
  expect(modelStore.getState().past).toHaveLength(1);
  act(() => {
    runCommand(commandById('reconnect-source'), recordingSurface().surface);
  });
  expect(
    screen.getByRole<HTMLSelectElement>('combobox', { name: 'Side' }).value,
  ).toBe('bottom');
  fireEvent.change(screen.getByRole('combobox', { name: 'Side' }), {
    target: { value: '' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply endpoint' }));
  expect(flowOf()?.kind === 'flow' && flowOf()?.source).toEqual({
    kind: 'attached',
    element: actorElement,
  });
});

it('toggles a flow between one way and both ways as one undo step each', () => {
  openCanvas([requestFlow]);
  render(<FlowEndpointCommands />);
  fireEvent.click(
    screen.getByRole('button', { name: /Toggle bidirectional flow/u }),
  );
  expect(flowOf()).toMatchObject({ bidirectional: true });
  fireEvent.click(
    screen.getByRole('button', { name: /Toggle bidirectional flow/u }),
  );
  expect(flowOf()).toMatchObject({ bidirectional: false });
  expect(modelStore.getState().past).toHaveLength(2);
});
