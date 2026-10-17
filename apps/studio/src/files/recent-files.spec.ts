import { act, renderHook, waitFor } from '@testing-library/react';
import { Fragment, StrictMode } from 'react';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { sampleModel } from '../store/store.fixtures.js';
import type { FileResult, OpenOutcome, RecentFile } from './bridge.js';
import { chosenFile, sampleNativeText, specBridge } from './files.fixtures.js';
import { useRecentFiles } from './recent-files.js';

const land = vi.fn<(result: FileResult<OpenOutcome>) => void>();

const opened = (result: FileResult<OpenOutcome>): void => {
  result.settle(true);
};

const names = (files: readonly RecentFile[]): readonly string[] =>
  files.map(({ name }) => name);

const pause = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  });
};

beforeEach(() => {
  modelStore.setState(initialState(sampleModel), true);
});

describe('useRecentFiles', () => {
  it('settles when its caller hands it a new bridge on every render', async () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useRecentFiles(
        specBridge({ recent: [chosenFile('model.yaml', sampleNativeText)] }),
        land,
      );
    });
    await waitFor(() => {
      expect(result.current.files).toHaveLength(1);
    });
    const settledAt = renders;

    await pause();

    expect(renders).toBe(settledAt);
  });

  it.each([
    ['plainly', Fragment],
    ['under StrictMode', StrictMode],
  ] as const)(
    'moves a reopened file to the top of the list it shows, %s',
    async (_, wrapper) => {
      const bridge = specBridge({
        recent: [
          chosenFile('first.yaml', sampleNativeText),
          chosenFile('second.yaml', sampleNativeText),
        ],
      });
      const { result } = renderHook(() => useRecentFiles(bridge, opened), {
        wrapper,
      });
      await waitFor(() => {
        expect(names(result.current.files)).toEqual([
          'first.yaml',
          'second.yaml',
        ]);
      });

      act(() => {
        result.current.reopen({ key: 'second.yaml', name: 'second.yaml' });
      });

      await waitFor(() => {
        expect(names(result.current.files)).toEqual([
          'second.yaml',
          'first.yaml',
        ]);
      });
    },
  );
});
