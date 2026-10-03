import { Either } from 'effect';
import { reasonOf } from './reason.js';

/**
 * Writes `text` to the system clipboard, or answers the text the browser
 * refused the write with. A promised text is asked for at once, as a
 * `ClipboardItem` holding the promise where the browser has one, so the write
 * keeps the press that asked for it however long the text takes: Firefox
 * refuses a `writeText` that follows seconds of work. A promise answering
 * nothing writes nothing.
 */
export async function writeClipboard(
  text: string | Promise<string | undefined>,
): Promise<Either.Either<void, string>> {
  try {
    await written(text);
    return Either.right(undefined);
  } catch (cause) {
    return Either.left(reasonOf(cause));
  }
}

function written(text: string | Promise<string | undefined>): Promise<void> {
  if (typeof text === 'string') {
    return navigator.clipboard.writeText(text);
  }
  if (typeof ClipboardItem === 'undefined') {
    return text.then((settled) =>
      settled === undefined
        ? undefined
        : navigator.clipboard.writeText(settled),
    );
  }
  return navigator.clipboard.write([
    new ClipboardItem({
      'text/plain': text.then((settled) =>
        settled === undefined
          ? Promise.reject(new Error('There is no text to write.'))
          : new Blob([settled], { type: 'text/plain' }),
      ),
    }),
  ]);
}
