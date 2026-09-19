import {
  canvasClassNames,
  toReactFlowEdges,
  wrappedTextStyles,
} from '@saerskriven/canvas';
import { locales } from '@saerskriven/i18n';
import type { ElementId } from '@saerskriven/model';
import { renderTerms } from '@saerskriven/render';
import { act, fireEvent, render } from '@testing-library/react';
import { Position, ReactFlowProvider } from '@xyflow/react';
import userEvent from '@testing-library/user-event';
import { hostPlatform } from '../commands/shortcuts.js';
import { elementById } from '../store/selectors.js';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';
import { canvasModel, noteElement } from './canvas.fixtures.js';
import { DiagramCanvas } from './diagram-canvas.js';
import { editingEdgeTypes } from './inline-editing.js';
import { currentLayout } from './layout.js';
import { chooseLanguage } from '../messages/locale.js';
import { actorElement, processElement } from '../store/store.fixtures.js';
import { softHyphen } from '@saerskriven/model/fixtures';
import { textbox } from '../ui/ui.fixtures.js';

const editing = (
  elementId: ElementId,
  kind: 'name' | 'note' = 'name',
): void => {
  modelStore.setState(
    {
      ...initialState(canvasModel),
      selection: [elementId],
      inlineEditor: { kind, elementId },
    },
    true,
  );
  resetAnnouncements();
};

const nameOf = (elementId: ElementId): string | undefined =>
  elementById(modelStore.getState(), elementId)?.name;

const textOf = (elementId: ElementId): string | undefined => {
  const element = elementById(modelStore.getState(), elementId);
  return element?.kind === 'text' ? element.text : undefined;
};

const state = () => modelStore.getState();

const drawnText = (elementId: ElementId, run: string): Element | null =>
  document.querySelector(`[data-id="${elementId}"] text.${run}`);

describe('the inline editor', () => {
  it('labels a name field with what it renames', () => {
    editing(actorElement);
    render(<DiagramCanvas />);

    expect(textbox('Name of Reader')).toHaveProperty('value', 'Reader');
  });

  it('commits a name on Enter as one undo step', async () => {
    const user = userEvent.setup();
    editing(actorElement);
    render(<DiagramCanvas />);

    await user.clear(textbox('Name of Reader'));
    await user.type(textbox('Name of Reader'), 'Auditor{Enter}');

    expect(nameOf(actorElement)).toBe('Auditor');
    expect(state().past).toHaveLength(1);
    expect(state().inlineEditor).toBeUndefined();
  });

  it('commits a name when it is left', async () => {
    const user = userEvent.setup();
    editing(actorElement);
    render(<DiagramCanvas />);

    await user.clear(textbox('Name of Reader'));
    await user.type(textbox('Name of Reader'), 'Auditor');
    await user.tab();

    expect(nameOf(actorElement)).toBe('Auditor');
    expect(document.activeElement?.getAttribute('data-id')).not.toBe(
      actorElement,
    );
  });

  it('leaves the name alone on Escape', async () => {
    const user = userEvent.setup();
    editing(actorElement);
    render(<DiagramCanvas />);

    await user.clear(textbox('Name of Reader'));
    await user.type(textbox('Name of Reader'), 'Auditor{Escape}');

    expect(nameOf(actorElement)).toBe('Reader');
    expect(state().past).toEqual([]);
    expect(state().inlineEditor).toBeUndefined();
  });

  it('dispatches nothing for a name the model already holds', async () => {
    const user = userEvent.setup();
    editing(actorElement);
    render(<DiagramCanvas />);

    await user.type(textbox('Name of Reader'), '{Enter}');

    expect(state().present).toBe(canvasModel);
    expect(state().past).toEqual([]);
    expect(state().inlineEditor).toBeUndefined();
  });

  it('keeps a refused character on screen and announces its position', async () => {
    const user = userEvent.setup();
    editing(actorElement);
    render(<DiagramCanvas />);

    await user.clear(textbox('Name of Reader'));
    await user.type(
      textbox('Name of Reader'),
      `Soft${softHyphen}hyphen{Enter}`,
    );

    expect(nameOf(actorElement)).toBe('Reader');
    expect(state().inlineEditor).toEqual({
      kind: 'name',
      elementId: actorElement,
    });
    expect(textbox('Name of Reader')).toHaveProperty(
      'value',
      `Soft${softHyphen}hyphen`,
    );
    expect(currentAnnouncement().message).toContain('Reader');
    expect(currentAnnouncement().message).toContain('5');
  });

  it.each(['   ', ''])('refuses an empty name', async (name) => {
    const user = userEvent.setup();
    editing(actorElement);
    render(<DiagramCanvas />);

    await user.clear(textbox('Name of Reader'));
    await user.type(textbox('Name of Reader'), `${name}{Enter}`);

    expect(nameOf(actorElement)).toBe('Reader');
    expect(state().inlineEditor).toEqual({
      kind: 'name',
      elementId: actorElement,
    });
    expect(currentAnnouncement().message.trim()).not.toBe('');
  });

  it('commits multiline note text on blur as one undo step', async () => {
    const user = userEvent.setup();
    editing(noteElement, 'note');
    render(<DiagramCanvas />);
    const note = textbox('Note text');

    await user.clear(note);
    await user.type(note, 'First line{Enter}Second line');
    await user.tab();

    expect(textOf(noteElement)).toBe('First line\nSecond line');
    expect(state().past).toHaveLength(1);
    expect(state().inlineEditor).toBeUndefined();
  });

  it('commits a Note with the platform modifier and leaves the foreign one alone', async () => {
    const user = userEvent.setup();
    editing(noteElement, 'note');
    render(<DiagramCanvas />);
    const note = textbox('Note text');

    await user.clear(note);
    await user.type(note, 'Changed');
    fireEvent.keyDown(note, {
      key: 'Enter',
      ...(hostPlatform === 'apple' ? { ctrlKey: true } : { metaKey: true }),
    });

    expect(textOf(noteElement)).not.toBe('Changed');
    expect(state().inlineEditor).toEqual({
      kind: 'note',
      elementId: noteElement,
    });

    fireEvent.keyDown(note, {
      key: 'Enter',
      ...(hostPlatform === 'apple' ? { metaKey: true } : { ctrlKey: true }),
    });

    expect(textOf(noteElement)).toBe('Changed');
    expect(state().inlineEditor).toBeUndefined();
  });
});

describe('the field standing where the text is drawn', () => {
  it('takes the place of a name while it is open, and hands it back', async () => {
    const user = userEvent.setup();
    editing(actorElement);
    render(<DiagramCanvas />);

    expect(drawnText(actorElement, canvasClassNames.label)).toBeNull();

    await user.type(textbox('Name of Reader'), '{Escape}');

    expect(drawnText(actorElement, canvasClassNames.label)).not.toBeNull();
  });

  it('is set in the type the text is drawn in', () => {
    editing(noteElement, 'note');
    render(<DiagramCanvas />);

    expect(textbox('Note text').style.fontSize).toBe(
      `${String(wrappedTextStyles.note.fontSize)}px`,
    );
  });

  it('stays inside the box of the element it names', () => {
    editing(processElement);
    render(<DiagramCanvas />);

    expect(textbox('Name of Studio').style.maxHeight).toBe('60px');
  });

  it('keeps a name on one line when pasted text carries a line break', async () => {
    const user = userEvent.setup();
    editing(actorElement);
    render(<DiagramCanvas />);

    await user.clear(textbox('Name of Reader'));
    await user.paste('Audit\nor');

    expect(textbox('Name of Reader')).toHaveProperty('value', 'Auditor');
  });
});

describe('a flow on the canvas', () => {
  afterEach(() => {
    act(() => {
      chooseLanguage('en-CA');
    });
    globalThis.localStorage.clear();
  });

  it("letters its badge with render's mark for the active locale", () => {
    modelStore.setState(
      initialState({
        ...canvasModel,
        threats: canvasModel.threats.map((threat) => ({
          ...threat,
          severity: 'high' as const,
        })),
      }),
      true,
    );
    const FlowBody = editingEdgeTypes.flow;
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          {toReactFlowEdges(currentLayout(modelStore.getState())).map(
            (edge) => (
              <FlowBody
                data={edge.data}
                id={edge.id}
                key={edge.id}
                source={edge.source}
                sourcePosition={Position.Right}
                sourceX={0}
                sourceY={0}
                target={edge.target}
                targetPosition={Position.Left}
                targetX={0}
                targetY={0}
              />
            ),
          )}
        </svg>
      </ReactFlowProvider>,
    );
    const mark = (): string | null | undefined =>
      container.querySelector(`.${canvasClassNames.badgeMark}`)?.textContent;

    for (const locale of locales) {
      act(() => {
        chooseLanguage(locale);
      });

      expect(mark()).toBe(renderTerms(locale).marks.severity.high);
    }
  });
});
