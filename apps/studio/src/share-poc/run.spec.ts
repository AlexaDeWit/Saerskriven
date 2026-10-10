import { readLimits } from '@saerskriven/formats';
import { Either } from 'effect';
import { runSharePoc, sharePocDeadline, SharePocFailure } from './run.js';

const request = { kind: 'decode', fragment: '#share=1.AA' } as const;
const reply = {
  kind: 'decoded',
  title: 'Model',
  yaml: 'formatVersion: 2',
} as const;

class TestWorker extends EventTarget {
  readonly postMessage =
    vi.fn<(message: unknown, transfer: Transferable[]) => void>();
  readonly terminate = vi.fn<Worker['terminate']>();
}

const workerPort = () => new TestWorker();

describe('one isolated share worker', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('disposes the worker after a valid reply', async () => {
    const worker = workerPort();
    const signal = new AbortController().signal;
    const pending = runSharePoc(request, signal, () => worker);
    worker.dispatchEvent(new MessageEvent('message', { data: reply }));
    expect(await pending).toEqual(Either.right(reply));
    expect(worker.postMessage).toHaveBeenCalledWith(request, []);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('cancels and ignores a late reply', async () => {
    const worker = workerPort();
    const controller = new AbortController();
    const pending = runSharePoc(request, controller.signal, () => worker);
    controller.abort();
    worker.dispatchEvent(new MessageEvent('message', { data: reply }));
    expect(await pending).toEqual(Either.left(SharePocFailure.Cancelled()));
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('stops a worker at the deadline', async () => {
    vi.useFakeTimers();
    const worker = workerPort();
    const pending = runSharePoc(
      request,
      new AbortController().signal,
      () => worker,
    );
    await vi.advanceTimersByTimeAsync(sharePocDeadline);
    expect(await pending).toEqual(Either.left(SharePocFailure.TimedOut()));
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('starts no worker for a cancelled or oversized request', async () => {
    const create = vi.fn<() => TestWorker>(workerPort);
    const controller = new AbortController();
    controller.abort();
    expect(await runSharePoc(request, controller.signal, create)).toEqual(
      Either.left(SharePocFailure.Cancelled()),
    );
    const oversized = {
      kind: 'encode',
      text: 'x'.repeat(readLimits.maxTextBytes + 1),
      base: 'https://example.test/',
    } as const;
    expect(
      await runSharePoc(oversized, new AbortController().signal, create),
    ).toEqual(Either.left(SharePocFailure.InvalidRequest()));
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses a malformed worker reply', async () => {
    const worker = workerPort();
    const pending = runSharePoc(
      request,
      new AbortController().signal,
      () => worker,
    );
    worker.dispatchEvent(
      new MessageEvent('message', { data: { kind: 'decoded' } }),
    );
    expect(await pending).toEqual(Either.left(SharePocFailure.InvalidReply()));
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('reports worker startup and post failures', async () => {
    const signal = new AbortController().signal;
    const start = await runSharePoc(request, signal, () => {
      throw new Error('start failed');
    });
    expect(Either.isLeft(start) && start.left._tag).toBe('Unavailable');
    const worker = workerPort();
    worker.postMessage.mockImplementation(() => {
      throw new Error('post failed');
    });
    const post = await runSharePoc(request, signal, () => worker);
    expect(Either.isLeft(post) && post.left._tag).toBe('Unavailable');
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it.each([
    [
      new ErrorEvent('error', { message: 'module failed', cancelable: true }),
      'Unavailable',
    ],
    [new Event('error'), 'Unavailable'],
    [new MessageEvent('messageerror'), 'InvalidReply'],
  ])('disposes a worker after %s', async (event, tag) => {
    const worker = workerPort();
    const pending = runSharePoc(
      request,
      new AbortController().signal,
      () => worker,
    );
    worker.dispatchEvent(event);
    const result = await pending;
    expect(Either.isLeft(result) && result.left._tag).toBe(tag);
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('observes cancellation during worker construction before posting', async () => {
    const worker = workerPort();
    const controller = new AbortController();
    const result = await runSharePoc(request, controller.signal, () => {
      controller.abort();
      return worker;
    });
    expect(result).toEqual(Either.left(SharePocFailure.Cancelled()));
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
