import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { RestoreMark } from '../store/recovery-storage.js';
import { memoryRestoreMark } from '../store/store.fixtures.js';
import { ErrorBoundary } from '../ui/error-boundary.js';
import { useRestoreSettled } from './restore-settled.js';

function Breaks(): never {
  throw new Error('failure');
}

function Drawn({
  children,
  mark,
}: {
  readonly children?: ReactNode;
  readonly mark: RestoreMark;
}) {
  useRestoreSettled(mark);
  return children;
}

describe('useRestoreSettled', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('lowers the mark once the draw has stood for two frames', () => {
    const mark = memoryRestoreMark(true);
    render(
      <ErrorBoundary>
        <Drawn mark={mark} />
      </ErrorBoundary>,
    );

    vi.advanceTimersToNextFrame();
    expect(mark.raised()).toBe(true);
    vi.advanceTimersToNextFrame();
    expect(mark.raised()).toBe(false);
  });

  it('leaves the mark raised where a child throws while rendering before then', () => {
    const mark = memoryRestoreMark(true);
    const { rerender } = render(
      <ErrorBoundary>
        <Drawn mark={mark} />
      </ErrorBoundary>,
    );
    vi.advanceTimersToNextFrame();

    rerender(
      <ErrorBoundary>
        <Drawn mark={mark}>
          <Breaks />
        </Drawn>
      </ErrorBoundary>,
    );
    vi.advanceTimersToNextFrame();
    vi.advanceTimersToNextFrame();

    expect(screen.getByRole('region')).toBeDefined();
    expect(mark.raised()).toBe(true);
  });
});

const tenFrames = 160;

const aSecond = 1_000;

const reportTab = (state: DocumentVisibilityState): void => {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
};

describe('useRestoreSettled in a tab that draws no frame', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    reportTab('hidden');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('lowers the mark on a timer, long after two frames would have come', () => {
    const mark = memoryRestoreMark(true);
    render(
      <ErrorBoundary>
        <Drawn mark={mark} />
      </ErrorBoundary>,
    );

    vi.advanceTimersByTime(tenFrames);
    expect(mark.raised()).toBe(true);
    vi.advanceTimersByTime(aSecond);
    expect(mark.raised()).toBe(false);
  });

  it('starts no timer where the tab is shown, so the mark is still raised well past a second', () => {
    reportTab('visible');
    const mark = memoryRestoreMark(true);
    render(
      <ErrorBoundary>
        <Drawn mark={mark} />
      </ErrorBoundary>,
    );

    vi.advanceTimersByTime(10 * aSecond);

    expect(mark.raised()).toBe(true);
  });

  it('leaves the mark raised where a child throws while rendering before the timer', () => {
    const mark = memoryRestoreMark(true);
    const { rerender } = render(
      <ErrorBoundary>
        <Drawn mark={mark} />
      </ErrorBoundary>,
    );

    rerender(
      <ErrorBoundary>
        <Drawn mark={mark}>
          <Breaks />
        </Drawn>
      </ErrorBoundary>,
    );
    vi.runAllTimers();

    expect(screen.getByRole('region')).toBeDefined();
    expect(mark.raised()).toBe(true);
  });
});
