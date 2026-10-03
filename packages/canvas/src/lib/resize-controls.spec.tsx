import { ReactFlow, type Node, type NodeProps } from '@xyflow/react';
import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { touchEvent, ViewKeepingMouseEvent, type Finger } from '../fixtures.js';
import { nodeNamed, specResizeLabels } from './canvas.fixtures.js';
import type { NodeBox } from './handles.js';
import type { CanvasNodeData } from './react-flow.js';
import { ResizeControls } from './resize-controls.js';
import { keyboardResizeStep } from './resizing.js';

type ControlledNode = Node<CanvasNodeData, 'controlled'>;

const client = nodeNamed('el-client');

const resize = vi.fn<() => void>();

const resizeEnd = vi.fn<(box: NodeBox, fromResizingRender: boolean) => void>();

function Controlled({ data }: NodeProps<ControlledNode>): ReactElement {
  const [resizing, setResizing] = useState(false);
  return (
    <ResizeControls
      labels={specResizeLabels(data.node)}
      node={data.node}
      onResize={() => {
        setResizing(true);
        resize();
      }}
      onResizeEnd={(box) => {
        setResizing(false);
        resizeEnd(box, resizing);
      }}
      visible
    />
  );
}

const nodeTypes = { controlled: Controlled };

const nodes: ControlledNode[] = [
  {
    id: client.id,
    type: 'controlled',
    position: client.position,
    data: { node: client },
  },
];

const row = 100;

const mouse = (type: string, clientX: number): MouseEvent =>
  new ViewKeepingMouseEvent(type, {
    bubbles: true,
    clientX,
    clientY: row,
    view: window,
  });

const finger = (identifier: number, clientX: number): Finger => ({
  identifier,
  clientX,
  clientY: row,
});

const keyDown = (key: string): KeyboardEvent =>
  new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

const rightControl = (): HTMLButtonElement => {
  const control = [...document.querySelectorAll('button')].find(
    (button) =>
      button.getAttribute('aria-label') === specResizeLabels(client).right,
  );
  assert.isDefined(control);
  return control;
};

const pressRightControl = (movedBy: number): void => {
  const control = rightControl();
  act(() => {
    control.dispatchEvent(mouse('mousedown', 100));
    if (movedBy !== 0) {
      control.dispatchEvent(mouse('mousemove', 100 + movedBy));
    }
    control.dispatchEvent(mouse('mouseup', 100 + movedBy));
  });
};

const touchRight = (
  type: 'touchstart' | 'touchmove' | 'touchend',
  changed: Finger,
  touches?: readonly Finger[],
): void => {
  act(() => {
    rightControl().dispatchEvent(touchEvent(type, changed, touches));
  });
};

const touchRightControl = (moves: readonly number[]): void => {
  touchRight('touchstart', finger(1, 100));
  for (const movedBy of moves) {
    touchRight('touchmove', finger(1, 100 + movedBy));
  }
  touchRight('touchend', finger(1, 100 + (moves.at(-1) ?? 0)), []);
};

describe('ResizeControls', () => {
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    root = createRoot(document.body.appendChild(document.createElement('div')));
    act(() => {
      root.render(<ReactFlow defaultNodes={nodes} nodeTypes={nodeTypes} />);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.replaceChildren();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('hands no resize end to a press released without a resize', () => {
    pressRightControl(0);

    expect(resizeEnd).not.toHaveBeenCalled();
  });

  it('hands one resize end to a press that resized, and none to the still press after it', () => {
    pressRightControl(40);

    expect(resize).toHaveBeenCalled();
    expect(resizeEnd).toHaveBeenCalledTimes(1);

    pressRightControl(0);

    expect(resizeEnd).toHaveBeenCalledTimes(1);
  });

  it('hands a touch resize one end through a render that gives it new callbacks, and none to the still touch after it', () => {
    touchRightControl([20, 40]);

    expect(resize).toHaveBeenCalledTimes(2);
    expect(resizeEnd).toHaveBeenCalledTimes(1);

    touchRightControl([]);

    expect(resizeEnd).toHaveBeenCalledTimes(1);
  });

  it('ends a resize on the callbacks of the render its press began on', () => {
    touchRightControl([20]);

    expect(resizeEnd).toHaveBeenCalledExactlyOnceWith(expect.anything(), false);
  });

  it('hands a touch resize one end, at the box it finished on, when a second touch on its control lifts first', () => {
    const second = finger(2, 100);
    touchRight('touchstart', finger(1, 100));
    touchRight('touchmove', finger(1, 120));
    touchRight('touchstart', second, [finger(1, 120), second]);
    touchRight('touchend', second, [finger(1, 120)]);

    expect(resizeEnd).not.toHaveBeenCalled();

    touchRight('touchmove', finger(1, 160));
    touchRight('touchend', finger(1, 160), []);

    expect(resize).toHaveBeenCalledTimes(2);
    expect(resizeEnd).toHaveBeenCalledExactlyOnceWith(
      { position: client.position, size: { ...client.size, width: 60 } },
      false,
    );
  });

  it('ends a touch resize at the box its press found when its controls unmount under it, and not again on the lift', () => {
    const control = rightControl();
    touchRight('touchstart', finger(1, 100));
    touchRight('touchmove', finger(1, 140));
    act(() => {
      root.unmount();
    });
    act(() => {
      control.dispatchEvent(touchEvent('touchend', finger(1, 140), []));
    });

    expect(resizeEnd).toHaveBeenCalledExactlyOnceWith(
      { position: client.position, size: client.size },
      false,
    );
  });

  it('ends a mouse resize on its release, at the box it finished on, after its controls unmount', () => {
    const control = rightControl();
    act(() => {
      control.dispatchEvent(mouse('mousedown', 100));
    });
    act(() => {
      window.dispatchEvent(mouse('mousemove', 140));
    });
    act(() => {
      root.unmount();
    });

    expect(resizeEnd).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(mouse('mouseup', 140));
    });

    expect(resizeEnd).toHaveBeenCalledExactlyOnceWith(
      { position: client.position, size: { ...client.size, width: 40 } },
      false,
    );
  });

  it('hands one resize end to an arrow key on the axis of its control, and none to a key off it', () => {
    act(() => {
      rightControl().dispatchEvent(keyDown('ArrowUp'));
      rightControl().dispatchEvent(keyDown('ArrowRight'));
    });

    expect(resizeEnd).toHaveBeenCalledExactlyOnceWith(
      {
        position: client.position,
        size: { ...client.size, width: client.size.width + keyboardResizeStep },
      },
      false,
    );
  });
});
