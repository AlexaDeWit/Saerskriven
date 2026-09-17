import {
  boundaryElement,
  noteElement,
  openCanvas,
  requestFlow,
} from './canvas.fixtures.js';
import {
  chooserOpened,
  commitFlowTarget,
  currentConnecting,
  startFlow,
} from './connecting.js';
import {
  actorElement,
  heldElements,
  processElement,
} from '../store/store.fixtures.js';

describe('startFlow', () => {
  it('opens the chooser on the selected element', () => {
    openCanvas([actorElement]);

    startFlow();

    expect(currentConnecting()).toEqual({
      open: true,
      from: actorElement,
    });
  });

  it('starts nothing from a selection no flow can run from', () => {
    for (const selection of [
      [],
      [boundaryElement],
      [noteElement],
      [requestFlow],
    ]) {
      openCanvas(selection);

      startFlow();

      expect(currentConnecting().open).toBe(false);
    }
  });
});

describe('commitFlowTarget', () => {
  it('draws the flow from the element the command started at', () => {
    openCanvas([actorElement]);
    startFlow();

    const drew = commitFlowTarget(processElement);

    expect(drew).toBe(true);
    expect(heldElements()).toBe(7);
    expect(currentConnecting()).toEqual({ open: false, from: undefined });
  });

  it('leaves a choice made outside a flow to the Connect control', () => {
    openCanvas([actorElement]);
    chooserOpened(true);

    const drew = commitFlowTarget(processElement);

    expect(drew).toBe(false);
    expect(heldElements()).toBe(6);
  });
});

describe('chooserOpened', () => {
  it('cancels a flow in progress when the chooser closes, drawing nothing', () => {
    openCanvas([actorElement]);
    startFlow();

    chooserOpened(false);

    expect(currentConnecting()).toEqual({ open: false, from: undefined });
    expect(heldElements()).toBe(6);
  });
});
