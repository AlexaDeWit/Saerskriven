import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { Point } from '@saerskriven/model';
import { elementIn } from '@saerskriven/model/fixtures';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  BoundaryShapeCommands,
  SelectionControls,
  FlowEndpointCommands,
} from './selection-controls.js';
import {
  commandById,
  runCommand,
  type CommandId,
} from '../commands/registry.js';
import {
  drawnAs,
  iconOnly,
  recordingSurface,
  runRegistered,
  tooltipOnFocus,
} from '../commands/commands.fixtures.js';
import { selectTool } from './tools.js';
import { currentAnnouncement } from './announcements.js';
import {
  actorElement,
  mainDiagram,
  newProcess,
  processElement,
  sampleModel,
} from '../store/store.fixtures.js';
import {
  boundaryElement,
  canvasModel,
  curvedCanvasModel,
  laidOutNode,
  openCanvas,
  requestFlow,
} from './canvas.fixtures.js';
import { currentLayout } from './layout.js';

const flowOf = () =>
  modelStore
    .getState()
    .present.diagrams[0].elements.find((element) => element.kind === 'flow');

const sourceDrawn = () =>
  currentLayout(modelStore.getState()).edges.find(
    (edge) => edge.id === requestFlow,
  )?.source;

const bothWaysToggle = () =>
  screen.getByRole('button', { name: 'Toggle bidirectional flow' });

const opened = (form: CommandId) => {
  render(<SelectionControls />);
  runRegistered(form);
};

const curvedThrough = (waypoints: Point[]) => ({
  ...curvedCanvasModel,
  diagrams: curvedCanvasModel.diagrams.map((diagram) => ({
    ...diagram,
    elements: diagram.elements.map((element) =>
      element.id === boundaryElement && element.kind === 'trust-boundary'
        ? { ...element, shape: { kind: 'curve' as const, waypoints } }
        : element,
    ),
  })),
});

beforeEach(() => {
  openCanvas([actorElement]);
});

describe('SelectionControls', () => {
  it('holds geometry drafts until Apply and records position plus size as one edit', async () => {
    opened('edit-geometry');
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
    expect(
      elementIn(modelStore.getState().present, actorElement),
    ).toMatchObject({
      position: { x: 1 },
      size: { height: 90 },
    });
    expect(
      screen.queryByRole('region', { name: 'Position and size' }),
    ).toBeNull();
  });

  it('stores a typed position and size as typed, from a position that is not the origin', () => {
    openCanvas([processElement]);
    expect(laidOutNode(processElement).position.x).not.toBe(0);
    opened('edit-geometry');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'X' }), {
      target: { value: '10.1234' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Width' }), {
      target: { value: '120.987654' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply geometry' }));

    expect(laidOutNode(processElement)).toMatchObject({
      position: { x: 10.1234, y: 0 },
      size: { width: 120.987654, height: 60 },
    });
  });

  it('stores at most six decimals, so a long number in one field does not spoil the one typed in another', () => {
    dispatch(
      Action.MoveElement({
        elementId: actorElement,
        offset: { x: 3742.089, y: 80.1234567890123 },
        decimals: undefined,
      }),
    );
    expect(laidOutNode(actorElement).position).toEqual({
      x: 3742.089,
      y: 80.1234567890123,
    });
    opened('edit-geometry');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'X' }), {
      target: { value: '530.189' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply geometry' }));

    expect(laidOutNode(actorElement)).toMatchObject({
      position: { x: 530.189, y: 80.123457 },
      size: { width: 120, height: 60 },
    });
  });

  it('keeps at least three decimals on every element a typed group position moves', () => {
    openCanvas([actorElement, processElement]);
    for (const [elementId, offset] of [
      [actorElement, { x: 10.5, y: 20 }],
      [processElement, { x: 0.456, y: 80.75 }],
    ] as const) {
      dispatch(Action.MoveElement({ elementId, offset, decimals: 3 }));
    }
    expect(laidOutNode(processElement).position).toEqual({
      x: 300.456,
      y: 80.75,
    });
    opened('edit-geometry');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'X' }), {
      target: { value: '100' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply geometry' }));

    expect(laidOutNode(actorElement).position).toEqual({ x: 100, y: 20 });
    expect(laidOutNode(processElement).position).toEqual({
      x: 389.956,
      y: 80.75,
    });
    expect(modelStore.getState().past).toHaveLength(3);
  });

  it('lands a multi-selection on the typed position, though its offset from the stored one is not exact', () => {
    openCanvas([actorElement, processElement]);
    dispatch(
      Action.MoveElements({
        elementIds: [actorElement, processElement],
        offset: { x: 40, y: 40 },
        decimals: undefined,
      }),
    );
    opened('edit-geometry');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Y' }), {
      target: { value: '12.98765' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply geometry' }));

    expect(laidOutNode(actorElement).position).toEqual({ x: 40, y: 12.98765 });
    expect(laidOutNode(processElement).position).toEqual({
      x: 340,
      y: 12.98765,
    });
  });

  it('steps a field by one at the decimals it is written with', () => {
    opened('edit-geometry');
    const x = screen.getByRole<HTMLInputElement>('spinbutton', { name: 'X' });
    fireEvent.change(x, { target: { value: '-128.998' } });

    fireEvent.click(screen.getByRole('button', { name: 'Increase X' }));
    expect(x.value).toBe('-127.998');

    fireEvent.click(screen.getByRole('button', { name: 'Decrease X' }));
    expect(x.value).toBe('-128.998');
  });

  it("shows a trust boundary curve's width and height and scales its points to them as one edit", () => {
    openCanvas([boundaryElement], curvedCanvasModel);
    const node = laidOutNode(boundaryElement);
    opened('edit-geometry');
    const height = screen.getByRole<HTMLInputElement>('spinbutton', {
      name: 'Height',
    });
    expect(height.value).toBe(String(node.size.height));
    fireEvent.change(height, {
      target: { value: String(node.size.height + 100) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply geometry' }));
    expect(modelStore.getState().past).toEqual([curvedCanvasModel]);
    expect(
      elementIn(modelStore.getState().present, boundaryElement),
    ).toMatchObject({
      shape: {
        kind: 'curve',
        waypoints: [
          { x: -20, y: 180 },
          { x: 200, y: -20 },
          { x: 440, y: 180 },
        ],
      },
    });
  });

  it('shows only the width of a trust boundary curve along one level line, and scales it along the line', () => {
    const levelModel = curvedThrough([
      { x: -20, y: 80 },
      { x: 440, y: 80 },
    ]);
    openCanvas([boundaryElement], levelModel);
    opened('edit-geometry');
    expect(screen.queryByRole('spinbutton', { name: 'Height' })).toBeNull();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Width' }), {
      target: { value: String(laidOutNode(boundaryElement).size.width + 460) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply geometry' }));
    expect(modelStore.getState().past).toEqual([levelModel]);
    expect(
      elementIn(modelStore.getState().present, boundaryElement),
    ).toMatchObject({
      shape: {
        kind: 'curve',
        waypoints: [
          { x: -20, y: 80 },
          { x: 900, y: 80 },
        ],
      },
    });
  });

  it("keeps at least three decimals on a trust boundary curve's points, which a typed position moves without showing them", () => {
    openCanvas(
      [boundaryElement],
      curvedThrough([
        { x: 10, y: 10 },
        { x: 50.12345, y: 30.56789 },
        { x: 100, y: 60 },
      ]),
    );
    opened('edit-geometry');
    const x = screen.getByRole<HTMLInputElement>('spinbutton', { name: 'X' });
    expect(x.value).toBe('8');
    fireEvent.change(x, { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply geometry' }));

    expect(
      elementIn(modelStore.getState().present, boundaryElement),
    ).toMatchObject({
      shape: {
        kind: 'curve',
        waypoints: [
          { x: 20, y: 10 },
          { x: 60.123, y: 30.568 },
          { x: 110, y: 60 },
        ],
      },
    });
  });

  it('retains invalid dimensions and cancels by Escape without history', () => {
    opened('edit-geometry');
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
    opened('edit-geometry');
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

  it('reports a flow-only geometry selection and ignores editor requests during placement', () => {
    openCanvas([requestFlow]);
    opened('edit-geometry');
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
    opened('reconnect-source');
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
    runRegistered('reconnect-source');
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

  it('frees the chosen endpoint at a typed position, starting from where it is drawn', () => {
    openCanvas([requestFlow]);
    const drawn = currentLayout(modelStore.getState()).edges.find(
      (edge) => edge.id === requestFlow,
    )?.target;
    opened('reconnect-target');
    const targets = screen.getByRole('combobox', { name: 'Target' });
    expect(within(targets).getAllByRole('option').at(0)).toBe(
      screen.getByRole('option', { name: 'Free point' }),
    );
    fireEvent.change(targets, { target: { value: '' } });
    expect(screen.queryByRole('combobox', { name: 'Side' })).toBeNull();
    expect(
      screen.getByRole<HTMLInputElement>('spinbutton', { name: 'Y' }).value,
    ).toBe(String(drawn?.y));
    fireEvent.change(screen.getByRole('spinbutton', { name: 'X' }), {
      target: { value: '520.123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply endpoint' }));
    expect(elementIn(modelStore.getState().present, requestFlow)).toMatchObject(
      {
        source: { kind: 'attached', element: actorElement },
        target: { kind: 'free', position: { x: 520.123456, y: drawn?.y } },
      },
    );
    expect(modelStore.getState().past).toEqual([canvasModel]);
  });

  it('stores a typed free end at six decimals at the most', () => {
    openCanvas([requestFlow]);
    opened('reconnect-target');
    fireEvent.change(screen.getByRole('combobox', { name: 'Target' }), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'X' }), {
      target: { value: '520.1234567' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply endpoint' }));

    expect(flowOf()).toMatchObject({
      target: { kind: 'free', position: { x: 520.123457 } },
    });
  });

  it('starts a freed end at its anchor written at three decimals, and stores it as shown', () => {
    openCanvas([requestFlow]);
    dispatch(
      Action.MoveElement({
        elementId: actorElement,
        offset: { x: -123.636, y: 0.98765 },
        decimals: undefined,
      }),
    );
    expect(sourceDrawn()).toEqual({ x: -3.6359999999999957, y: 30.98765 });
    opened('reconnect-source');
    fireEvent.change(screen.getByRole('combobox', { name: 'Source' }), {
      target: { value: '' },
    });

    expect(
      screen.getByRole<HTMLInputElement>('spinbutton', { name: 'X' }).value,
    ).toBe('-3.636');
    fireEvent.click(screen.getByRole('button', { name: 'Apply endpoint' }));
    expect(elementIn(modelStore.getState().present, requestFlow)).toMatchObject(
      { source: { kind: 'free', position: { x: -3.636, y: 30.988 } } },
    );
  });

  it('starts an end already free at the position it has stored, whatever its decimals', () => {
    openCanvas([requestFlow]);
    dispatch(
      Action.SetFlowEndPosition({
        elementId: requestFlow,
        side: 'source',
        position: { x: 12.3456789, y: 30 },
        decimals: undefined,
      }),
    );
    opened('reconnect-source');

    expect(
      screen.getByRole<HTMLInputElement>('spinbutton', { name: 'X' }).value,
    ).toBe('12.3456789');
  });

  it('keeps a free endpoint whose position is not a number in the form', () => {
    openCanvas([requestFlow]);
    opened('reconnect-source');
    fireEvent.change(screen.getByRole('combobox', { name: 'Source' }), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'X' }), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply endpoint' }));
    expect(modelStore.getState().present).toBe(canvasModel);
    expect(screen.getByRole('region', { name: 'Flow endpoint' })).toBeDefined();
  });
});

describe('FlowEndpointCommands', () => {
  it('changes either endpoint with a chooser and keeps cancelling out of history', () => {
    dispatch(
      Action.AddElement({
        diagramId: mainDiagram,
        element: newProcess('extra-node', 'Extra'),
        decimals: undefined,
      }),
    );
    const base = modelStore.getState().present;
    modelStore.setState(
      { ...initialState(base), selection: [requestFlow] },
      true,
    );
    render(
      <>
        <SelectionControls />
        <FlowEndpointCommands />
      </>,
    );
    expect(
      screen.getByRole('button', { name: 'Change flow source' }),
    ).toBeDefined();
    runRegistered('reconnect-source');
    fireEvent.change(screen.getByRole('combobox', { name: 'Source' }), {
      target: { value: 'extra-node' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply endpoint' }));
    expect(elementIn(modelStore.getState().present, requestFlow)).toMatchObject(
      {
        source: { kind: 'attached', element: 'extra-node' },
      },
    );
    runRegistered('reconnect-target');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(modelStore.getState().past).toEqual([base]);
  });

  it('draws its four commands as icons named by their full labels', () => {
    openCanvas([requestFlow]);
    render(<FlowEndpointCommands />);
    const card = screen.getByRole('region', { name: 'Reconnect flow' });
    for (const name of [
      'Change flow source',
      'Change flow target',
      'Toggle bidirectional flow',
      'Reverse flow',
    ]) {
      expect(drawnAs(within(card).getByRole('button', { name }))).toEqual(
        iconOnly,
      );
    }
  });

  it.each([
    'reconnect-source',
    'reconnect-target',
    'toggle-flow-direction',
    'reverse-flow',
  ] as const)(
    'names %s and its registered chord in a tooltip on focus',
    async (command) => {
      openCanvas([requestFlow]);
      render(<FlowEndpointCommands />);
      const { tooltip, label, chord } = await tooltipOnFocus(command);
      expect(tooltip.textContent).toContain(label);
      expect(tooltip.textContent).toContain(chord);
    },
  );

  it('toggles a flow between one way and both ways as one undo step each, pressed while it runs both ways', () => {
    openCanvas([requestFlow]);
    render(<FlowEndpointCommands />);
    expect(bothWaysToggle().getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(bothWaysToggle());
    expect(flowOf()).toMatchObject({ bidirectional: true });
    expect(bothWaysToggle().getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(bothWaysToggle());
    expect(flowOf()).toMatchObject({ bidirectional: false });
    expect(bothWaysToggle().getAttribute('aria-pressed')).toBe('false');
    expect(modelStore.getState().past).toHaveLength(2);
  });

  it('reverses a flow as one undo step', () => {
    openCanvas([requestFlow]);
    render(<FlowEndpointCommands />);
    fireEvent.click(screen.getByRole('button', { name: 'Reverse flow' }));
    expect(flowOf()).toMatchObject({
      source: { kind: 'attached', element: processElement },
      target: { kind: 'attached', element: actorElement },
    });
    expect(modelStore.getState().past).toEqual([canvasModel]);
  });
});

const shapeOf = () => {
  const boundary = elementIn(modelStore.getState().present, boundaryElement);
  return boundary.kind === 'trust-boundary' ? boundary.shape.kind : undefined;
};

describe('BoundaryShapeCommands', () => {
  it('draws Switch boundary shape as an icon, with its registered chord in a tooltip on focus', async () => {
    openCanvas([boundaryElement]);
    render(<BoundaryShapeCommands />);
    const control = within(
      screen.getByRole('region', { name: 'Trust boundary' }),
    ).getByRole('button', { name: 'Switch boundary shape' });
    expect(drawnAs(control)).toEqual(iconOnly);
    expect(control.hasAttribute('aria-pressed')).toBe(false);
    const { tooltip, label, chord } = await tooltipOnFocus(
      'toggle-boundary-shape',
    );
    expect(tooltip.textContent).toContain(label);
    expect(tooltip.textContent).toContain(chord);
  });

  it('switches the selected boundary between a box and a curve as one undo step each', () => {
    openCanvas([boundaryElement]);
    render(<BoundaryShapeCommands />);
    const card = screen.getByRole('region', { name: 'Trust boundary' });
    fireEvent.click(
      within(card).getByRole('button', { name: 'Switch boundary shape' }),
    );
    expect(shapeOf()).toBe('curve');
    fireEvent.click(
      screen.getByRole('button', { name: 'Switch boundary shape' }),
    );
    expect(shapeOf()).toBe('box');
    expect(modelStore.getState().past).toHaveLength(2);
  });

  it('stands only while one trust boundary is selected with the Select tool', () => {
    openCanvas([requestFlow]);
    const { rerender } = render(<BoundaryShapeCommands />);
    expect(screen.queryByRole('region', { name: 'Trust boundary' })).toBeNull();
    act(() => {
      dispatch(Action.Select({ elementIds: [boundaryElement] }));
    });
    rerender(<BoundaryShapeCommands />);
    expect(
      screen.getByRole('region', { name: 'Trust boundary' }),
    ).toBeDefined();
    act(() => {
      selectTool('hand');
    });
    expect(screen.queryByRole('region', { name: 'Trust boundary' })).toBeNull();
  });
});
