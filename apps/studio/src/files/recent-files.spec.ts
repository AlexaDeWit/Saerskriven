import { act, renderHook, waitFor } from '@testing-library/react';
import type { FileResult, OpenOutcome } from './bridge.js';
import { chosenFile, sampleNativeText, specBridge } from './files.fixtures.js';
import { useRecentFiles } from './recent-files.js';

const land = vi.fn<(result: FileResult<OpenOutcome>) => void>();

const pause = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  });
};

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
});
