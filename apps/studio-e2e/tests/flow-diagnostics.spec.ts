import type { TestInfo } from '@playwright/test';
import { vi } from 'vitest';
import { withFailureEvidence } from '../src/flow-diagnostics.fixtures.js';

const setup = () => {
  const evaluate = vi
    .fn<() => Promise<unknown>>()
    .mockResolvedValue({ flowId: 'placeholder-flow' });
  const attach = vi.fn<TestInfo['attach']>().mockResolvedValue(undefined);
  const recover = vi.fn<() => Promise<string | null>>().mockResolvedValue(null);
  const assertionFailure = new Error('original public assertion failure');
  const run = () =>
    withFailureEvidence(
      { attach },
      () => Promise.reject(assertionFailure),
      evaluate,
      recover,
    );
  return { evaluate, attach, recover, assertionFailure, run };
};

afterEach(() => vi.clearAllMocks());

describe('flow failure evidence', () => {
  it('does no inspection or attachment when the assertion passes', async () => {
    const { evaluate, attach, recover } = setup();
    await withFailureEvidence(
      { attach },
      () => Promise.resolve(),
      evaluate,
      recover,
    );
    expect(evaluate).not.toHaveBeenCalled();
    expect(recover).not.toHaveBeenCalled();
    expect(attach).not.toHaveBeenCalled();
  });

  it('captures before recovery and attaches evidence without replacing the original failure', async () => {
    const { evaluate, attach, recover, assertionFailure, run } = setup();
    recover.mockImplementation(() => {
      expect(evaluate).toHaveBeenCalledTimes(1);
      return Promise.resolve(
        '{"version":2,"document":{"privateText":"excluded"}}',
      );
    });
    await expect(run()).rejects.toBe(assertionFailure);
    expect(attach).toHaveBeenCalledWith('flow-failure-state', {
      contentType: 'application/json',
      body: JSON.stringify({
        snapshot: { flowId: 'placeholder-flow' },
        recovery: {
          format: 'native-wire-envelope',
          status: 'available',
          byteLength: 51,
          version: 2,
        },
      }),
    });
  });

  it('reports unavailable capture and storage while preserving the original failure', async () => {
    const { evaluate, attach, recover, assertionFailure, run } = setup();
    evaluate.mockRejectedValue(new Error('page unavailable'));
    recover.mockRejectedValue(new Error('storage refused'));
    await expect(run()).rejects.toBe(assertionFailure);
    expect(attach).toHaveBeenCalledTimes(1);
    expect(attach.mock.calls[0]?.[1]?.body).toContain('unavailable');
    expect(attach.mock.calls[0]?.[1]?.body).toContain('native-wire-envelope');
  });

  it('preserves the original failure when the attachment rejects', async () => {
    const { attach, assertionFailure, run } = setup();
    attach.mockRejectedValue(new Error('attachment refused'));
    await expect(run()).rejects.toBe(assertionFailure);
  });

  it('preserves the original failure when the attachment throws before returning a promise', async () => {
    const { attach, assertionFailure, run } = setup();
    attach.mockImplementation(() => {
      throw new Error('attachment refused');
    });
    await expect(run()).rejects.toBe(assertionFailure);
  });
});
