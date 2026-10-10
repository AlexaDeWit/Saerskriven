import { Data, Either } from 'effect';
import { reasonOf } from '../reason.js';
import {
  sharePocReplySchema,
  sharePocRequestSchema,
  type SharePocReply,
  type SharePocRequest,
} from './protocol.js';

/** A codec worker's deadline, including module loading and validation. */
export const sharePocDeadline = 15_000;

/** Failures outside the wire codec itself. */
export type SharePocFailure = Data.TaggedEnum<{
  Cancelled: {};
  TimedOut: {};
  Unavailable: { readonly reason: string };
  InvalidReply: {};
  InvalidRequest: {};
}>;

/** Constructors and matchers for worker failures. */
export const SharePocFailure = Data.taggedEnum<SharePocFailure>();

type WorkerPort = EventTarget & {
  readonly postMessage: (
    message: SharePocRequest,
    transfer: Transferable[],
  ) => void;
  readonly terminate: () => void;
};

/** Runs one request in a fresh worker and releases it on every completion path. */
export function runSharePoc(
  request: SharePocRequest,
  signal: AbortSignal,
  createWorker: () => WorkerPort = () =>
    new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
): Promise<Either.Either<SharePocReply, SharePocFailure>> {
  if (signal.aborted)
    return Promise.resolve(Either.left(SharePocFailure.Cancelled()));
  if (!sharePocRequestSchema.safeParse(request).success)
    return Promise.resolve(Either.left(SharePocFailure.InvalidRequest()));
  const created = Either.try({
    try: createWorker,
    catch: (error) => SharePocFailure.Unavailable({ reason: reasonOf(error) }),
  });
  if (Either.isLeft(created)) return Promise.resolve(Either.left(created.left));
  const worker = created.right;
  return new Promise((resolve) => {
    let settled = false;
    const finish = (
      result: Either.Either<SharePocReply, SharePocFailure>,
    ): void => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      signal.removeEventListener('abort', cancel);
      worker.removeEventListener('message', receive);
      worker.removeEventListener('error', failed);
      worker.removeEventListener('messageerror', invalid);
      worker.terminate();
      resolve(result);
    };
    const cancel = (): void => {
      finish(Either.left(SharePocFailure.Cancelled()));
    };
    const deadline = setTimeout(() => {
      finish(Either.left(SharePocFailure.TimedOut()));
    }, sharePocDeadline);
    const receive = (event: Event): void => {
      if (!(event instanceof MessageEvent)) {
        finish(Either.left(SharePocFailure.InvalidReply()));
        return;
      }
      const parsed = sharePocReplySchema.safeParse(event.data);
      finish(
        parsed.success
          ? Either.right(parsed.data)
          : Either.left(SharePocFailure.InvalidReply()),
      );
    };
    const failed = (event: Event): void => {
      event.preventDefault();
      finish(
        Either.left(
          SharePocFailure.Unavailable({
            reason:
              event instanceof ErrorEvent
                ? event.message
                : 'The worker failed.',
          }),
        ),
      );
    };
    const invalid = (): void => {
      finish(Either.left(SharePocFailure.InvalidReply()));
    };
    signal.addEventListener('abort', cancel, { once: true });
    worker.addEventListener('message', receive);
    worker.addEventListener('error', failed);
    worker.addEventListener('messageerror', invalid);
    if (signal.aborted) {
      cancel();
      return;
    }
    try {
      worker.postMessage(request, []);
    } catch (error) {
      finish(
        Either.left(SharePocFailure.Unavailable({ reason: reasonOf(error) })),
      );
    }
  });
}
