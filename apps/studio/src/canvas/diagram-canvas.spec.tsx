import {
  canvasClassNames,
  canvasInteractionClassNames,
  flowEndNodeId,
} from '@saerskriven/canvas';
import { finger, mouseEvent, touchEvent } from '@saerskriven/canvas/fixtures';
import { locales } from '@saerskriven/i18n';
import { renderTerms } from '@saerskriven/render';
import { elementIn } from '@saerskriven/model/fixtures';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  contextualShortcuts,
  type ContextualShortcutId,
} from '../commands/contextual-shortcuts.js';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { commandById, runCommand } from '../commands/registry.js';
import {
  hostPlatform,
  shortcutLabelText,
  spellShortcuts,
  type ShortcutEntry,
} from '../commands/shortcuts.js';
import { activeTranslator, chooseLanguage } from '../messages/locale.js';
import { currentAnnouncement } from './announcements.js';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  boundaryCurve,
  boundaryElement,
  canvasModel,
  curvedCanvasModel,
  flaggedCanvasModel,
  laidOutNode,
  noteElement,
  openCanvas,
  probeFlow,
  requestFlow,
  viewportTransform,
} from './canvas.fixtures.js';
import { resetThreatRegister } from '../panel/threat-register-state.js';
import { DiagramCanvas } from './diagram-canvas.js';
import { followItemMoves } from './move-message.js';
import { placementClickDistance } from './elements.js';
import { currentLayout } from './layout.js';
import {
  actorElement,
  heldElements,
  processElement,
} from '../store/store.fixtures.js';

const contextualEntry = (id: ContextualShortcutId): ShortcutEntry => {
  const entry = contextualShortcuts.find((candidate) => candidate.id === id);
  if (entry === undefined) {
    throw new Error(`${id} is no contextual shortcut`);
  }
  return entry;
};

const { t } = activeTranslator();

const spelled = ({ label, shortcuts }: ShortcutEntry): string =>
  `${shortcutLabelText(label, t)}: ${spellShortcuts(shortcuts, hostPlatform, t)}`;

const reader = (): HTMLElement =>
  screen.getByRole('group', { name: /^Reader, actor/u });

const readerInAnyLocale = (): HTMLElement =>
  screen.getByRole('group', { name: /^Reader, /u });

const readerMark = (): string | null | undefined =>
  readerInAnyLocale().querySelector(`.${canvasClassNames.badgeMark}`)
    ?.textContent;

const note = (): HTMLElement =>
  screen.getByRole('group', { name: /^Note, text/u });

const readerBox = () => {
  const { position, size } = laidOutNode(actorElement);
  return { position, size };
};

const probeFreeEnd = () =>
  currentLayout(modelStore.getState()).edges.find(
    (edge) => edge.id === probeFlow,
  )?.target;

const resizeControl = (from: string): HTMLElement =>
  screen.getByRole('button', { name: `Resize Reader from ${from}` });

const readerGlyphWidth = (): string | null | undefined =>
  reader().querySelector('svg')?.getAttribute('width');

const touchResizeReader = (): void => {
  fireEvent(resizeControl('right'), touchEvent('touchstart', finger(1, 100)));
  fireEvent(resizeControl('right'), touchEvent('touchmove', finger(1, 160)));
};

const stillPressReader = (): void => {
  fireEvent(resizeControl('right'), mouseEvent('mousedown', 100));
  fireEvent(window, mouseEvent('mouseup', 100));
};

const press = {
  button: 0,
  clientX: 40,
  clientY: 40,
  isPrimary: true,
  pointerId: 1,
  pointerType: 'mouse',
};

const nodeDescriptionText = (): string | null | undefined =>
  document.querySelector('[id^="react-flow__node-desc"]')?.textContent;

const reconnect = (): HTMLElement =>
  screen.getByRole('region', { name: 'Reconnect flow', hidden: true });

const flowLiveMessage = (): string | null | undefined =>
  document.querySelector('[id^="react-flow__aria-live"]')?.textContent;

const writtenAsPositionAndSize = ({ x, y }: { x: number; y: number }) => ({
  x: String(x),
  y: String(y),
});

describe('DiagramCanvas', () => {
  beforeEach(() => {
    openCanvas();
  });

  afterEach(() => {
    act(() => {
      chooseLanguage('en-CA');
    });
    globalThis.localStorage.clear();
  });

  it('mounts one node per element, each named from the model', () => {
    render(<DiagramCanvas />);

    expect(screen.getAllByRole('group')).toHaveLength(
      currentLayout(modelStore.getState()).nodes.length,
    );
    expect(
      screen.getAllByRole('group', {
        name: 'Reader, actor, 1 open threat, highest severity Medium',
      }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('group', { name: 'Studio, process' }),
    ).toHaveLength(1);
  });

  it("letters the badges with render's marks for the active locale, and names the severity in words", () => {
    openCanvas([], {
      ...canvasModel,
      threats: canvasModel.threats.map((threat) => ({
        ...threat,
        severity: 'high' as const,
      })),
    });
    render(<DiagramCanvas />);

    for (const locale of locales) {
      act(() => {
        chooseLanguage(locale);
      });
      const terms = renderTerms(locale);

      expect(readerMark()).toBe(terms.marks.severity.high);
      expect(readerInAnyLocale().getAttribute('aria-label')).toContain(
        terms.severity('high'),
      );
    }
    expect(
      new Set(locales.map((locale) => renderTerms(locale).marks.severity.high))
        .size,
    ).toBeGreaterThan(1);
  });

  it('reaches every element by keyboard', () => {
    render(<DiagramCanvas />);

    expect(
      screen
        .getAllByRole('group')
        .map((group) => group.getAttribute('tabindex')),
    ).toEqual(currentLayout(modelStore.getState()).nodes.map(() => '0'));
  });

  it('draws the selection the store holds', () => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);

    expect(reader().classList.contains('selected')).toBe(true);
  });

  it("raises a selected trust boundary's badge into the viewport portal at the boundary's place, and keeps it in the boundary while unselected", () => {
    openCanvas(
      [],
      flaggedCanvasModel({
        'threat-path-disclosure': { elements: [boundaryElement] },
      }),
    );
    render(<DiagramCanvas />);
    const badge = `.${canvasClassNames.badge}`;
    const boundary = document.querySelector(`[data-id="${boundaryElement}"]`);
    const portal = document.querySelector('.react-flow__viewport-portal');

    expect(boundary?.querySelector(badge)).not.toBeNull();
    expect(portal?.querySelector(badge)).toBeNull();

    act(() => {
      dispatch(Action.Select({ elementIds: [boundaryElement] }));
    });
    const raised = portal?.querySelector<SVGElement>(
      `.${canvasInteractionClassNames.badgeLayer}`,
    );
    const { position } = laidOutNode(boundaryElement);

    expect(boundary?.querySelector(badge)).toBeNull();
    expect(raised?.querySelector(badge)).not.toBeNull();
    expect(raised?.style.left).toBe(`${String(position.x)}px`);
    expect(raised?.style.top).toBe(`${String(position.y)}px`);
  });

  it('selects the element that was clicked, through the store', () => {
    render(<DiagramCanvas />);

    fireEvent.click(reader());

    expect(modelStore.getState().selection).toEqual([actorElement]);
    expect(reader().classList.contains('selected')).toBe(true);
  });

  it('draws a selection the store moves to after it has mounted', () => {
    render(<DiagramCanvas />);

    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement] }));
    });

    expect(reader().classList.contains('selected')).toBe(true);
  });

  it('removes the selected element on the delete key, and says what went with it', () => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'Delete' });

    expect(heldElements()).toBe(5);
    expect(currentAnnouncement().message).not.toBe('');
  });

  it('removes the selected flow on the backspace key', () => {
    openCanvas([requestFlow]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(screen.getByTestId('rf__wrapper'), { key: 'Backspace' });

    expect(heldElements()).toBe(5);
  });

  it('leaves the model alone on the delete key while nothing is selected', () => {
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'Delete' });

    expect(heldElements()).toBe(6);
    expect(currentAnnouncement().message).toBe('');
  });

  it('draws the threat panel over itself while an element is selected', () => {
    render(<DiagramCanvas />);
    expect(screen.queryByRole('region', { name: 'Threats' })).toBeNull();

    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement] }));
    });

    expect(screen.getByRole('region', { name: 'Threats' })).toBeDefined();
    expect(
      screen
        .getByTestId('canvas-container')
        .contains(screen.getByTestId('threat-panel')),
    ).toBe(true);
  });

  it('opens the selected element name on Enter', () => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'Enter' });

    expect(modelStore.getState().inlineEditor).toEqual({
      kind: 'name',
      elementId: actorElement,
    });
    expect(screen.getByRole('textbox', { name: 'Name of Reader' })).toBe(
      document.activeElement,
    );
  });

  it('opens the selected Note prose on Enter', () => {
    openCanvas([noteElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(note(), { key: 'Enter' });

    expect(modelStore.getState().inlineEditor).toEqual({
      kind: 'note',
      elementId: noteElement,
    });
    expect(screen.getByRole('textbox', { name: 'Note text' })).toBe(
      document.activeElement,
    );
  });

  it('leaves Enter to React Flow where the press is what selects the element', () => {
    render(<DiagramCanvas />);
    reader().focus();

    fireEvent.keyDown(reader(), { key: 'Enter' });

    expect(modelStore.getState().selection).toEqual([actorElement]);
    expect(document.activeElement).toBe(reader());
  });

  it('leaves Space to select without opening the text editor', () => {
    render(<DiagramCanvas />);
    reader().focus();

    fireEvent.keyDown(reader(), { key: ' ' });

    expect(modelStore.getState().selection).toEqual([actorElement]);
    expect(modelStore.getState().inlineEditor).toBeUndefined();

    fireEvent.keyDown(reader(), { key: ' ' });

    expect(modelStore.getState().inlineEditor).toBeUndefined();
  });

  it('reduces a group to the element clicked or activated with Enter', () => {
    openCanvas([actorElement, processElement]);
    render(<DiagramCanvas />);

    fireEvent.click(reader());
    expect(modelStore.getState().selection).toEqual([actorElement]);

    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement, processElement] }));
    });
    fireEvent.keyDown(reader(), { key: 'Enter' });
    expect(modelStore.getState().selection).toEqual([actorElement]);
  });

  it('toggles a focused element with Shift+Enter', () => {
    openCanvas([actorElement, processElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'Enter', shiftKey: true });
    expect(modelStore.getState().selection).toEqual([processElement]);

    fireEvent.keyDown(reader(), { key: 'Enter', shiftKey: true });
    expect(modelStore.getState().selection).toEqual([
      processElement,
      actorElement,
    ]);
  });

  it('settles a keyboard move through the transient edge path', () => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'ArrowRight' });

    expect(modelStore.getState().past).toHaveLength(1);
  });

  it('says where each Arrow and Shift+Arrow press put the element, in the figures Position and size shows', () => {
    openCanvas([actorElement]);
    dispatch(
      Action.MoveElement({
        elementId: actorElement,
        offset: { x: 28.5, y: 12.25 },
      }),
    );
    render(<DiagramCanvas />);

    for (const chord of [
      { key: 'ArrowRight' },
      { key: 'ArrowRight', shiftKey: true },
      { key: 'ArrowDown' },
      { key: 'ArrowUp', shiftKey: true },
      { key: 'ArrowLeft' },
    ]) {
      fireEvent.keyDown(reader(), chord);

      expect(flowLiveMessage()).toBe(
        t('canvas.node-moved', writtenAsPositionAndSize(readerBox().position)),
      );
    }
    expect(readerBox().position).toEqual({ x: 48.5, y: -2.75 });
  });

  it('says where Position and size places a group moved from an element off its corner', () => {
    openCanvas([actorElement, processElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(screen.getByRole('group', { name: 'Studio, process' }), {
      key: 'ArrowDown',
    });

    expect(flowLiveMessage()).toBe(
      t('canvas.node-moved', writtenAsPositionAndSize({ x: 0, y: 5 })),
    );
  });

  it('says a move again where an undo between two moves puts the element in the same place', () => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);
    fireEvent.keyDown(reader(), { key: 'ArrowRight' });
    const first = flowLiveMessage();

    act(() => {
      dispatch(Action.Undo());
    });
    fireEvent.keyDown(reader(), { key: 'ArrowRight' });

    expect(flowLiveMessage()).not.toBe(first);
    expect(flowLiveMessage()?.trim()).toBe(first);
  });

  it('says nothing for an arrow key on a focused element the selection leaves out', () => {
    openCanvas([processElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'ArrowRight' });

    expect(flowLiveMessage()).toBe('');
  });

  it('says where the element went when an arrow key off a resize control axis moves it instead', () => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(resizeControl('top'), { key: 'ArrowLeft' });

    expect(readerBox().position).toEqual({ x: -5, y: 0 });
    expect(flowLiveMessage()).toBe(
      t('canvas.node-moved', writtenAsPositionAndSize(readerBox().position)),
    );
  });

  it.each([
    [
      'top',
      'ArrowUp',
      { position: { x: 0, y: -5 }, size: { width: 120, height: 65 } },
    ],
    [
      'right',
      'ArrowRight',
      { position: { x: 0, y: 0 }, size: { width: 125, height: 60 } },
    ],
    [
      'bottom',
      'ArrowDown',
      { position: { x: 0, y: 0 }, size: { width: 120, height: 65 } },
    ],
    [
      'left',
      'ArrowLeft',
      { position: { x: -5, y: 0 }, size: { width: 125, height: 60 } },
    ],
  ] as const)(
    'resizes from the %s by keyboard with the opposite side fixed',
    (from, key, expected) => {
      openCanvas([actorElement]);
      render(<DiagramCanvas />);

      fireEvent.keyDown(resizeControl(from), { key });

      expect(readerBox()).toEqual(expected);
      expect(modelStore.getState().past).toHaveLength(1);
    },
  );

  it('tells the view of a resize by keyboard, so the view can follow the control', () => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);
    const told = vi.fn<() => void>();
    const release = followItemMoves(told);

    fireEvent.keyDown(resizeControl('right'), { key: 'ArrowRight' });

    expect(told).toHaveBeenCalledOnce();
    release();
  });

  it("scales a trust boundary curve's points by keyboard with the opposite side fixed, as one undo step", () => {
    openCanvas([boundaryElement], curvedCanvasModel);
    render(<DiagramCanvas />);

    fireEvent.keyDown(
      screen.getByRole('button', { name: 'Resize Perimeter from top' }),
      { key: 'ArrowUp', shiftKey: true },
    );

    const boundary = elementIn(modelStore.getState().present, boundaryElement);
    const points =
      boundary.kind === 'trust-boundary' && boundary.shape.kind === 'curve'
        ? boundary.shape.waypoints
        : [];
    expect(points.map((point) => point.x)).toEqual(
      boundaryCurve.map((point) => point.x),
    );
    expect([points[0]?.y, points[2]?.y]).toEqual([80, 80]);
    expect(points[1]?.y).toBeCloseTo(-40);
    expect(modelStore.getState().past).toEqual([curvedCanvasModel]);
  });

  it('shrinks in the reverse direction and undo restores the full box', () => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);
    const before = readerBox();

    fireEvent.keyDown(resizeControl('top'), { key: 'ArrowDown' });

    expect(readerBox()).toEqual({
      position: { x: 0, y: 5 },
      size: { width: 120, height: 55 },
    });
    act(() => {
      dispatch(Action.Undo());
    });
    expect(readerBox()).toEqual(before);
  });

  it('puts back a touch resize whose element is deselected under it, with no undo step, and a still press after it records nothing', () => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);
    const settled = readerGlyphWidth();

    touchResizeReader();
    expect(readerGlyphWidth()).not.toBe(settled);
    act(() => {
      dispatch(Action.Select({ elementIds: [] }));
    });

    expect(readerGlyphWidth()).toBe(settled);

    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement] }));
    });
    stillPressReader();

    expect(readerGlyphWidth()).toBe(settled);
    expect(modelStore.getState().past).toHaveLength(0);
  });

  it('puts back a touch resize that is cancelled, with no undo step, and a still press after it records nothing', () => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);
    const settled = [readerGlyphWidth(), reader().style.width];

    touchResizeReader();
    expect(reader().style.width).not.toBe(settled[1]);
    fireEvent(
      resizeControl('right'),
      touchEvent('touchcancel', finger(1, 160)),
    );

    expect([readerGlyphWidth(), reader().style.width]).toEqual(settled);

    stillPressReader();

    expect([readerGlyphWidth(), reader().style.width]).toEqual(settled);
    expect(modelStore.getState().past).toHaveLength(0);
  });

  it('clears a selected flow when the pointer lands on nothing', () => {
    openCanvas([requestFlow]);
    render(<DiagramCanvas />);
    const pane = document.querySelector('.react-flow__pane');
    expect(pane).not.toBeNull();

    fireEvent.pointerDown(pane ?? document.body, {
      button: 0,
      isPrimary: true,
      pointerId: 1,
    });
    fireEvent.pointerUp(pane ?? document.body, {
      button: 0,
      isPrimary: true,
      pointerId: 1,
    });

    expect(modelStore.getState().selection).toEqual([]);
  });

  describe('a press inside the bounds of the selection', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('moves a selected boundary, the elements inside it and a free flow end from its interior, in one undo step', () => {
      const group = [boundaryElement, actorElement, processElement];
      openCanvas([...group, probeFlow]);
      render(<DiagramCanvas />);
      act(() => {
        vi.advanceTimersByTime(1);
      });
      const pane = document.querySelector('.react-flow__pane') ?? document.body;
      const before = group.map((id) => laidOutNode(id).position);
      const freeBefore = probeFreeEnd();
      const { x, y, zoom } = viewportTransform();
      const between = { clientX: x + 200 * zoom, clientY: y + 40 * zoom };
      const moved = {
        clientX: between.clientX + 30 * zoom,
        clientY: between.clientY + 10 * zoom,
      };

      fireEvent.pointerDown(pane, { ...press, ...between });
      fireEvent.pointerMove(pane, { ...press, ...moved });
      fireEvent.pointerUp(pane, { ...press, ...moved });

      group.forEach((id, index) => {
        const { position } = laidOutNode(id);
        expect(position.x - before[index].x).toBeCloseTo(30);
        expect(position.y - before[index].y).toBeCloseTo(10);
      });
      expect((probeFreeEnd()?.x ?? 0) - (freeBefore?.x ?? 0)).toBeCloseTo(30);
      expect((probeFreeEnd()?.y ?? 0) - (freeBefore?.y ?? 0)).toBeCloseTo(10);
      expect(modelStore.getState().past).toHaveLength(1);
      act(() => {
        dispatch(Action.Undo());
      });
      expect(group.map((id) => laidOutNode(id).position)).toEqual(before);
      expect(probeFreeEnd()).toEqual(freeBefore);
    });
  });

  it('opens the name of a node in a field on the second click of a pair', () => {
    render(<DiagramCanvas />);

    fireEvent.click(reader(), { detail: 1 });
    fireEvent.click(reader(), { detail: 2 });

    expect(modelStore.getState().inlineEditor).toEqual({
      kind: 'name',
      elementId: actorElement,
    });
  });

  it('opens a Note prose field on the second click of a pair', () => {
    render(<DiagramCanvas />);

    fireEvent.click(note(), { detail: 1 });
    fireEvent.click(note(), { detail: 2 });

    expect(modelStore.getState().inlineEditor).toEqual({
      kind: 'note',
      elementId: noteElement,
    });
  });

  it('describes the canvas keys React Flow exposes with each item', () => {
    render(<DiagramCanvas />);

    const nodeDescription = document.querySelector(
      '[id^="react-flow__node-desc"]',
    );
    const flowDescription = document.querySelector(
      '[id^="react-flow__edge-desc"]',
    );

    for (const entry of [
      contextualEntry('select-canvas-item'),
      contextualEntry('edit-canvas-text'),
      commandById('hand-tool'),
      commandById('focus-threats'),
    ]) {
      expect(nodeDescription?.textContent).toContain(spelled(entry));
    }
    expect(flowDescription?.textContent).toContain(
      spelled(contextualEntry('edit-canvas-text')),
    );
  });

  it('rewords what React Flow and the resize controls say in a language chosen after it mounted', () => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);
    const english = nodeDescriptionText();

    act(() => {
      chooseLanguage('fr-CA');
    });
    const { t: french } = activeTranslator();
    fireEvent.keyDown(screen.getByRole('group', { name: /^Reader, /u }), {
      key: 'ArrowRight',
    });

    expect(nodeDescriptionText()).not.toBe(english);
    expect(nodeDescriptionText()).toContain(
      shortcutLabelText(contextualEntry('edit-canvas-text').label, french),
    );
    expect(
      screen.getByRole('button', {
        name: french('canvas.resize-top', { element: 'Reader' }),
      }),
    ).toBeDefined();
    expect(flowLiveMessage()).toBe(
      french(
        'canvas.node-moved',
        writtenAsPositionAndSize(readerBox().position),
      ),
    );
  });

  it('describes an element by role in a language chosen after it mounted, and a free end by none', () => {
    render(<DiagramCanvas />);
    const anchor = screen.getByTestId(
      `rf__node-${flowEndNodeId(probeFlow, 'target')}`,
    );

    for (const [locale, role] of [
      ['fr-CA', 'élément'],
      ['sv', 'element'],
    ] as const) {
      act(() => {
        chooseLanguage(locale);
      });

      expect(readerInAnyLocale().getAttribute('aria-roledescription')).toBe(
        role,
      );
      expect(anchor.hasAttribute('aria-roledescription')).toBe(false);
    }
  });

  it('describes the canvas keys to the application it labels', () => {
    render(<DiagramCanvas />);

    const canvas = screen.getByRole('application', { name: 'Diagram' });
    const description = canvas.getAttribute('aria-describedby') ?? '';

    expect(document.getElementById(description)?.textContent).toContain(
      spelled(contextualEntry('edit-canvas-text')),
    );
  });

  describe('a double-click over the panel', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('keeps the second press of a double-click out of the panel the first press opened, and edits the element', () => {
      render(<DiagramCanvas />);
      fireEvent.pointerDown(reader(), press);
      fireEvent.click(reader(), { detail: 1 });
      act(() => {
        dispatch(Action.Select({ elementIds: [actorElement] }));
      });
      const existing = screen.getByRole('combobox', {
        name: 'Existing threat',
      });

      fireEvent.pointerDown(existing, press);
      fireEvent.click(existing, { detail: 2 });

      expect(existing.getAttribute('aria-expanded')).toBe('false');
      expect(modelStore.getState().inlineEditor).toEqual({
        kind: 'name',
        elementId: actorElement,
      });
    });

    it('lets a keyboard activation after a shielded press reach its button', () => {
      render(<DiagramCanvas />);
      const threats = modelStore.getState().present.threats.length;
      fireEvent.pointerDown(reader(), press);
      act(() => {
        dispatch(Action.Select({ elementIds: [actorElement] }));
      });
      const existing = screen.getByRole('combobox', {
        name: 'Existing threat',
      });
      fireEvent.pointerDown(existing, press);
      expect(existing.getAttribute('aria-expanded')).toBe('false');

      fireEvent.click(screen.getByRole('button', { name: 'Add a threat' }), {
        detail: 0,
      });

      expect(modelStore.getState().present.threats).toHaveLength(threats + 1);
      expect(modelStore.getState().inlineEditor).toBeUndefined();
    });

    it('lets go of a shielded press the browser cancelled', () => {
      render(<DiagramCanvas />);
      const threats = modelStore.getState().present.threats.length;
      fireEvent.pointerDown(reader(), press);
      act(() => {
        dispatch(Action.Select({ elementIds: [actorElement] }));
      });
      const existing = screen.getByRole('combobox', {
        name: 'Existing threat',
      });
      fireEvent.pointerDown(existing, press);
      expect(existing.getAttribute('aria-expanded')).toBe('false');
      fireEvent.pointerCancel(existing, press);

      fireEvent.click(screen.getByRole('button', { name: 'Add a threat' }), {
        detail: 1,
      });

      expect(modelStore.getState().present.threats).toHaveLength(threats + 1);
      expect(modelStore.getState().inlineEditor).toBeUndefined();
    });

    it('arms nothing on a first press with another button', () => {
      render(<DiagramCanvas />);
      fireEvent.pointerDown(reader(), { ...press, button: 2 });
      act(() => {
        dispatch(Action.Select({ elementIds: [actorElement] }));
      });
      const existing = screen.getByRole('combobox', {
        name: 'Existing threat',
      });

      fireEvent.pointerDown(existing, press);

      expect(existing.getAttribute('aria-expanded')).toBe('true');
    });

    it('leaves a press on the panel that moved as far as a drag to the panel', () => {
      render(<DiagramCanvas />);
      fireEvent.pointerDown(reader(), press);
      act(() => {
        dispatch(Action.Select({ elementIds: [actorElement] }));
      });
      const existing = screen.getByRole('combobox', {
        name: 'Existing threat',
      });

      fireEvent.pointerDown(existing, {
        ...press,
        clientX: press.clientX + placementClickDistance,
      });

      expect(existing.getAttribute('aria-expanded')).toBe('true');
      expect(modelStore.getState().inlineEditor).toBeUndefined();
    });
  });

  it('leaves a click on a canvas control out of the rename gesture', () => {
    render(<DiagramCanvas />);

    fireEvent.click(reader(), { detail: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }), {
      detail: 2,
    });

    expect(modelStore.getState().inlineEditor).toBeUndefined();
  });

  it('holds the selection cards inert while the threat register covers them, and a card a command opens closes the register', () => {
    openCanvas([requestFlow]);
    resetThreatRegister();
    render(<DiagramCanvas />);
    expect(reconnect().closest('[inert]')).toBeNull();

    act(() => {
      runCommand(commandById('threat-register'), recordingSurface().surface);
    });
    expect(
      screen.getByRole('region', { name: 'Threat register' }),
    ).toBeDefined();
    expect(reconnect().closest('[inert]')).not.toBeNull();

    act(() => {
      runCommand(commandById('reconnect-source'), recordingSurface().surface);
    });

    expect(
      screen.queryByRole('region', { name: 'Threat register' }),
    ).toBeNull();
    expect(reconnect().closest('[inert]')).toBeNull();
    expect(screen.getByRole('region', { name: 'Flow endpoint' })).toBeDefined();
  });
});
