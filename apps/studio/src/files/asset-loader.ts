import { Either } from 'effect';
import { AssetFailure } from '../asset-failure.js';
import { reasonOf } from '../reason.js';

/** A repeatable load that reports an asset failure. */
export type Loaded<Value> = () => Promise<Either.Either<Value, AssetFailure>>;

/** Caches successful loads and shares one pending request. */
export function once<Value>(load: Loaded<Value>): Loaded<Value> {
  let held: Value | undefined;
  let loading: Promise<Either.Either<Value, AssetFailure>> | undefined;
  return async () => {
    if (held !== undefined) {
      return Either.right(held);
    }
    loading ??= load();
    const outcome = await loading;
    if (Either.isRight(outcome)) {
      held = outcome.right;
    } else {
      loading = undefined;
    }
    return outcome;
  };
}

/** Fetches bytes and preserves HTTP or transport failures. */
export async function fetchBytes(
  url: string,
): Promise<Either.Either<Uint8Array, AssetFailure>> {
  const response = await guarded(() => fetch(url));
  if (Either.isLeft(response)) {
    return Either.left(response.left);
  }
  if (!response.right.ok) {
    return Either.left(
      AssetFailure.Answered({ url, status: response.right.status }),
    );
  }
  const body = response.right;
  return guarded(async () => new Uint8Array(await body.arrayBuffer()));
}

async function guarded<Value>(
  work: () => Promise<Value>,
): Promise<Either.Either<Value, AssetFailure>> {
  try {
    return Either.right(await work());
  } catch (cause) {
    return Either.left(AssetFailure.Unavailable({ reason: reasonOf(cause) }));
  }
}
