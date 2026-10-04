import { act, fireEvent, render, screen } from '@testing-library/react';
import { CommandSurfaceProvider } from '../commands/binding.js';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { activeTranslator } from '../messages/locale.js';
import { actorElement, processElement } from '../store/store.fixtures.js';
import { modelStore } from '../store/store.js';
import { currentAnnouncement } from './announcements.js';
import { canvasModel, laidOutNode, openCanvas } from './canvas.fixtures.js';
import { DiagramCanvas } from './diagram-canvas.js';

const platform = vi.hoisted(() => ({ current: 'other' }));
vi.mock('../commands/shortcuts.js', async (original) => ({
  ...(await original<typeof import('../commands/shortcuts.js')>()),
  get hostPlatform() {
    return platform.current;
  },
}));

const pair = () =>
  [laidOutNode(actorElement), laidOutNode(processElement)].map(
    ({ position, size }) => ({ position, size }),
  );

const focused = (on: 'element' | 'resize'): HTMLElement =>
  on === 'element'
    ? screen.getByRole('group', { name: /^Reader, actor/u })
    : screen.getByRole('button', { name: 'Resize Reader from right' });

const openPair = () => {
  openCanvas([actorElement, processElement], {
    ...canvasModel,
    diagrams: canvasModel.diagrams.map((diagram) => ({
      ...diagram,
      elements: diagram.elements.map((element) =>
        element.id === processElement && element.kind === 'process'
          ? { ...element, position: { x: 300, y: 40 } }
          : element,
      ),
    })),
  });
};

beforeEach(() => {
  platform.current = 'other';
});

for (const host of ['other', 'apple']) {
  describe(`${host} modifier commands`, () => {
    beforeEach(() => {
      platform.current = host;
    });
    for (const on of ['element', 'resize'] as const) {
      it.each([
        [
          'ArrowLeft',
          [
            { x: 0, y: 0 },
            { x: 0, y: 40 },
          ],
        ],
        [
          'ArrowRight',
          [
            { x: 300, y: 0 },
            { x: 300, y: 40 },
          ],
        ],
        [
          'ArrowUp',
          [
            { x: 0, y: 0 },
            { x: 300, y: 0 },
          ],
        ],
        [
          'ArrowDown',
          [
            { x: 0, y: 40 },
            { x: 300, y: 40 },
          ],
        ],
      ])(
        `aligns from the ${on} on %s without moving or resizing besides`,
        (key, positions) => {
          openPair();
          const before = modelStore.getState().present;
          const sizes = pair().map(({ size }) => size);
          render(<DiagramCanvas />);
          const target = focused(on);
          act(() => {
            target.focus();
          });

          fireEvent.keyDown(target, {
            key,
            shiftKey: true,
            ctrlKey: host === 'other',
            metaKey: host === 'apple',
          });

          expect(pair().map(({ position }) => position)).toEqual(positions);
          expect(pair().map(({ size }) => size)).toEqual(sizes);
          expect(modelStore.getState().past).toEqual([before]);
          expect(currentAnnouncement().message).toBe(
            activeTranslator().t('canvas.arranged', { count: 2 }),
          );
          expect(
            document.querySelector('[id^="react-flow__aria-live"]')
              ?.textContent,
          ).toBe('');
          expect(document.activeElement).toBe(target);
        },
      );
      it(`leaves an unavailable alignment unchanged from the ${on}`, () => {
        openCanvas([actorElement]);
        render(<DiagramCanvas />);
        const before = modelStore.getState();

        fireEvent.keyDown(focused(on), {
          key: 'ArrowLeft',
          shiftKey: true,
          ctrlKey: host === 'other',
          metaKey: host === 'apple',
        });

        expect(modelStore.getState().present).toBe(before.present);
        expect(modelStore.getState().past).toBe(before.past);
        expect(currentAnnouncement().message).toBe('');
      });
    }
  });
}

it.each(['element', 'resize'] as const)(
  'keeps plain and Shift arrows on the %s',
  (on) => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);
    const target = focused(on);
    const before = laidOutNode(actorElement);

    fireEvent.keyDown(target, { key: 'ArrowRight' });
    fireEvent.keyDown(target, { key: 'ArrowRight', shiftKey: true });

    expect(laidOutNode(actorElement)).toMatchObject(
      on === 'element'
        ? {
            position: { x: before.position.x + 25, y: before.position.y },
            size: before.size,
          }
        : {
            position: before.position,
            size: { width: before.size.width + 25, height: before.size.height },
          },
    );
    expect(modelStore.getState().past).toHaveLength(2);
  },
);

it('runs another registered modifier command once on a focused item and leaves unknown chords to the browser', () => {
  openCanvas([actorElement]);
  const { surface, asked } = recordingSurface();
  render(
    <CommandSurfaceProvider surface={surface}>
      <DiagramCanvas />
    </CommandSurfaceProvider>,
  );

  fireEvent.keyDown(focused('element'), { key: 's', ctrlKey: true });
  expect(asked).toEqual(['save']);
  expect(
    fireEvent.keyDown(focused('element'), {
      key: 'q',
      ctrlKey: true,
      shiftKey: true,
    }),
  ).toBe(true);
  expect(modelStore.getState().past).toHaveLength(0);
});

it('keeps modifier arrows in an inline text field', () => {
  openPair();
  render(<DiagramCanvas />);
  fireEvent.keyDown(focused('element'), { key: 'Enter' });
  fireEvent.keyDown(focused('element'), { key: 'Enter' });
  const before = modelStore.getState().present;

  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Name of Reader' }), {
    key: 'ArrowLeft',
    ctrlKey: true,
    shiftKey: true,
  });

  expect(modelStore.getState().present).toBe(before);
  expect(modelStore.getState().past).toHaveLength(0);
});
