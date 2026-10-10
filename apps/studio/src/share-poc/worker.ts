import {
  readAnyFormat,
  renderReadFailure,
  saerskrivenYamlCodec,
  type ReadFailure,
} from '@saerskriven/formats';
import {
  readShareLinkPoc,
  writeShareLinkPoc,
} from '@saerskriven/formats/share-link-poc';
import {
  renderShareLinkWriteFailure,
  type ShareLinkFailure,
} from '@saerskriven/formats/share-link';
import { Either } from 'effect';
import { loadBrotliModule } from '../files/brotli-asset.js';
import { reasonOf } from '../reason.js';
import {
  sharePocRequestSchema,
  type SharePocReply,
  type SharePocRequest,
} from './protocol.js';

globalThis.addEventListener('message', (event: MessageEvent<unknown>): void => {
  const parsed = sharePocRequestSchema.safeParse(event.data);
  if (!parsed.success) {
    globalThis.postMessage(
      {
        kind: 'refused',
        message: 'The request exceeds a limit or has an invalid shape.',
      } satisfies SharePocReply,
      { transfer: [] },
    );
    return;
  }
  void respond(parsed.data);
});

async function respond(request: SharePocRequest): Promise<void> {
  try {
    globalThis.postMessage(await execute(request), { transfer: [] });
  } catch (error) {
    globalThis.postMessage(
      { kind: 'refused', message: reasonOf(error) } satisfies SharePocReply,
      { transfer: [] },
    );
  }
}

async function execute(request: SharePocRequest): Promise<SharePocReply> {
  const module = await loadBrotliModule();
  if (Either.isLeft(module))
    return { kind: 'refused', message: JSON.stringify(module.left) };
  if (request.kind === 'decode') {
    const result = await readShareLinkPoc(request.fragment, module.right);
    return Either.isLeft(result)
      ? { kind: 'refused', message: describeFailure(result.left) }
      : {
          kind: 'decoded',
          title: result.right.model.metadata.title,
          yaml: saerskrivenYamlCodec.write(result.right.model).output,
        };
  }
  const read = readAnyFormat(request.text);
  if (Either.isLeft(read)) {
    return {
      kind: 'refused',
      message:
        read.left._tag === 'NoFormatClaimed'
          ? 'Use a Saerskriven YAML or Threat Dragon JSON model.'
          : renderReadFailure(read.left).join('\n'),
    };
  }
  const written = await writeShareLinkPoc(
    read.right.model,
    request.base,
    module.right,
  );
  return Either.isLeft(written)
    ? { kind: 'refused', message: describeFailure(written.left) }
    : {
        kind: 'encoded',
        result: written.right,
        title: read.right.model.metadata.title,
      };
}

function describeFailure(failure: ShareLinkFailure | ReadFailure): string {
  switch (failure._tag) {
    case 'InvalidModel':
    case 'InvalidWireDocument':
    case 'ExceededReadLimit':
    case 'MalformedText':
      return renderReadFailure(failure).join('\n');
    case 'TooLong':
    case 'PastReadBound':
    case 'Unusable':
      return renderShareLinkWriteFailure(failure).join('\n');
    case 'Malformed':
      return failure.message;
    case 'NotAShareLink':
      return 'The input is not a share-link fragment.';
    case 'UnknownEncoding':
      return 'Unknown share encoding: ' + failure.prefix;
    default:
      return 'The share operation failed.';
  }
}
