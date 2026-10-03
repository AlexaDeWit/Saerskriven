import { ShareLinkFailure } from '@saerskriven/formats/share-link';
import { Data } from 'effect';
import type { Speaker } from '../messages/said.js';
import { LinkFailure } from '../store/state.js';
import type { NoticeText } from '../ui/detail-lines.js';
import { linkFailureLines } from '../ui/failure-notice.js';

/**
 * What the last Share did, as data the report region words. `Shared` is a
 * link on the clipboard, with its length in characters. `Refused` is a link
 * that was not written, and `ClipboardRefused` one the browser would not take,
 * with the text it raised.
 */
export type ShareNotice = Data.TaggedEnum<{
  Shared: { readonly length: number };
  Refused: { readonly failure: LinkFailure };
  ClipboardRefused: { readonly reason: string };
}>;

/** Constructors for {@link ShareNotice}, plus Effect's `$is` and `$match`. */
export const ShareNotice = Data.taggedEnum<ShareNotice>();

/**
 * A share notice in the reader's language. A link past the length a link may
 * hold points to Save, and the one written says who can read it.
 */
export function describeShareNotice(
  t: Speaker,
  notice: ShareNotice,
): NoticeText {
  return ShareNotice.$match(notice, {
    Shared: ({ length }) => ({
      headline: t('reports.shared', { length }),
      details: [t('reports.shared-disclosure')],
    }),
    Refused: ({ failure }) => ({
      headline: t(
        tooLarge(failure) ? 'reports.share-too-large' : 'reports.share-refused',
      ),
      details: linkFailureLines(t, failure),
    }),
    ClipboardRefused: ({ reason }) => ({
      headline: t('reports.share-clipboard-refused'),
      details: [reason],
    }),
  });
}

function tooLarge(failure: LinkFailure): boolean {
  return (
    LinkFailure.$is('Codec')(failure) &&
    (ShareLinkFailure.$is('TooLong')(failure.failure) ||
      ShareLinkFailure.$is('PastReadBound')(failure.failure))
  );
}
