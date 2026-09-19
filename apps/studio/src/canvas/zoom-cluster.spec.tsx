import { locales } from '@saerskriven/i18n';
import { ReactFlowProvider } from '@xyflow/react';
import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandSurfaceProvider } from '../commands/binding.js';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { chooseLanguage } from '../messages/locale.js';
import { button } from '../ui/ui.fixtures.js';
import { ZoomCluster } from './zoom-cluster.js';

describe('ZoomCluster', () => {
  it('names each icon after the command it runs, and says which chord runs it', () => {
    render(
      <ReactFlowProvider>
        <ZoomCluster />
      </ReactFlowProvider>,
    );

    expect(button('Zoom in').getAttribute('aria-keyshortcuts')).toBe(
      'Control+= Control+Plus',
    );
    expect(button('Zoom out').getAttribute('aria-keyshortcuts')).toBe(
      'Control+-',
    );
    expect(
      button('Reset zoom to 100%').getAttribute('aria-describedby'),
    ).toBeTruthy();
    expect(button('Fit to view').getAttribute('aria-keyshortcuts')).toBe(
      'Control+0',
    );
  });

  it('runs each viewport command against the surface it is mounted under', async () => {
    const user = userEvent.setup();
    const recording = recordingSurface();
    render(
      <ReactFlowProvider>
        <CommandSurfaceProvider surface={recording.surface}>
          <ZoomCluster />
        </CommandSurfaceProvider>
      </ReactFlowProvider>,
    );

    await user.click(button('Zoom in'));
    await user.click(button('Zoom out'));
    await user.click(button('Fit to view'));
    await user.click(button('Fit selection'));
    await user.click(button('Reset zoom to 100%'));

    expect(recording.asked).toEqual([
      'zoomIn',
      'zoomOut',
      'fitToView',
      'fitSelection',
      'resetZoom',
    ]);
  });

  describe('in each locale', () => {
    afterEach(() => {
      act(() => {
        chooseLanguage('en-CA');
      });
      globalThis.localStorage.clear();
    });

    it("writes the zoom in the reader's percent format", () => {
      render(
        <ReactFlowProvider>
          <ZoomCluster />
        </ReactFlowProvider>,
      );
      const reset = button('Reset zoom to 100%');

      for (const locale of locales) {
        act(() => {
          chooseLanguage(locale);
        });

        expect(reset.textContent).toBe(
          new Intl.NumberFormat(locale, { style: 'percent' }).format(1),
        );
      }
    });
  });
});
