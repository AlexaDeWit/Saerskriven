import type { Divergence, ReadFailure } from '@saerskriven/formats';
import {
  isShareLinkFragment,
  readShareLink,
  writeShareLink,
  type ShareLinkFailure,
} from '@saerskriven/formats/share-link';
import type { Model } from '@saerskriven/model';
import { Either } from 'effect';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AssetFailure } from '../asset-failure.js';
import { Action } from '../store/actions.js';
import { holdsUnsavedWork } from '../store/selectors.js';
import { LinkFailure } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { writeClipboard } from '../system-clipboard.js';
import { loadBrotliModule } from './render-assets.js';
import { linkFileName } from './session.js';
import { ShareNotice } from './share-notice.js';

/**
 * The brotli module a link is written and read with, and the clipboard Share
 * writes to, which a spec replaces. `copy` is handed the link while it is
 * still being written, and nothing where writing it fails.
 */
export type ShareLinks = {
  readonly module: () => Promise<Either.Either<Uint8Array, AssetFailure>>;
  readonly copy: (
    text: Promise<string | undefined>,
  ) => Promise<Either.Either<void, string>>;
};

/** The module loader and the clipboard the browser application uses. */
export const browserShareLinks: ShareLinks = {
  module: loadBrotliModule,
  copy: writeClipboard,
};

/** The model a shared link held, and what its read could not carry. */
export type LinkRead = {
  readonly model: Model;
  readonly divergences: readonly Divergence[];
};

/**
 * Writes `model` as a share link on the page at `base`, puts the link on the
 * clipboard, and answers the notice that reports it. The clipboard write is
 * asked for before the first await, so a caller running inside the press
 * that asked for Share keeps that press for the write. The module loads here
 * and nowhere earlier.
 */
export async function shareModel(
  model: Model,
  base: string,
  links: ShareLinks,
): Promise<ShareNotice> {
  const encoded = encodedLink(model, base, links);
  const copied = links.copy(
    encoded.then((link) => Either.getOrUndefined(link)),
  );
  const link = await encoded;
  if (Either.isLeft(link)) {
    return ShareNotice.Refused({ failure: link.left });
  }
  return Either.match(await copied, {
    onLeft: (reason) => ShareNotice.ClipboardRefused({ reason }),
    onRight: () => ShareNotice.Shared({ length: link.right.length }),
  });
}

/** The model a share link fragment holds, or why it holds none. */
export async function readLink(
  fragment: string,
  links: ShareLinks,
): Promise<Either.Either<LinkRead, LinkFailure>> {
  const module = await links.module();
  if (Either.isLeft(module)) {
    return Either.left(LinkFailure.Module({ failure: module.left }));
  }
  return Either.mapBoth(await readShareLink(fragment, module.right), {
    onLeft: linkFailureOf,
    onRight: ({ model, divergences }) => ({ model, divergences }),
  });
}

/**
 * The action a read link lands with: an import named after the model's
 * title, or `untitled` where the title leaves nothing, so the model arrives
 * unsaved.
 */
export function linkLanding(
  read: LinkRead,
  untitled: string,
): Extract<Action, { readonly _tag: 'Imported' }> {
  return Action.Imported({
    model: read.model,
    name: linkFileName(read.model.metadata.title, untitled),
    format: undefined,
    divergences: read.divergences,
  });
}

/** Share, its report, and the question a link arriving over unsaved work asks. */
export type ShareLinkSession = {
  readonly share: () => void;
  readonly notice: ShareNotice | undefined;
  readonly dismissNotice: () => void;
  readonly asking: boolean;
  readonly confirm: () => void;
  readonly cancel: () => void;
};

type Question = {
  readonly fragment: string;
  readonly read: LinkRead;
};

/**
 * Reads a share link fragment when the studio mounts and at each
 * `hashchange`. A link that reads lands through `land` while the session
 * holds no unsaved work, and otherwise waits on the question. A refused link
 * becomes the failure notice. The fragment goes once the link lands, is
 * refused, or the question is answered either way, and one fragment is read
 * once however often the effect runs, so the development server's double
 * effects ask once.
 */
export function useShareLink(
  links: ShareLinks,
  land: (read: LinkRead) => void,
): ShareLinkSession {
  const [notice, setNotice] = useState<ShareNotice | undefined>(undefined);
  const [asking, setAsking] = useState(false);
  const reading = useRef<string | undefined>(undefined);
  const question = useRef<Question | undefined>(undefined);

  const finish = useCallback((fragment: string): void => {
    if (reading.current === fragment) {
      reading.current = undefined;
    }
    dropFragment(fragment);
  }, []);

  const arrive = useCallback(async (): Promise<void> => {
    const fragment = globalThis.location.hash;
    if (!isShareLinkFragment(fragment) || reading.current === fragment) {
      return;
    }
    reading.current = fragment;
    question.current = undefined;
    setAsking(false);
    const read = await readLink(fragment, links);
    if (reading.current !== fragment) {
      return;
    }
    if (Either.isLeft(read)) {
      finish(fragment);
      dispatch(Action.LinkRefused({ failure: read.left }));
      return;
    }
    if (holdsUnsavedWork(modelStore.getState())) {
      question.current = { fragment, read: read.right };
      setAsking(true);
      return;
    }
    finish(fragment);
    land(read.right);
  }, [finish, land, links]);

  useEffect(() => {
    const arrived = (): void => {
      void arrive();
    };
    arrived();
    globalThis.addEventListener('hashchange', arrived);
    return () => {
      globalThis.removeEventListener('hashchange', arrived);
    };
  }, [arrive]);

  const settle = useCallback(
    (loads: boolean): void => {
      const asked = question.current;
      question.current = undefined;
      setAsking(false);
      if (asked === undefined) {
        return;
      }
      finish(asked.fragment);
      if (loads) {
        land(asked.read);
      }
    },
    [finish, land],
  );

  const share = useCallback((): void => {
    const run = async (): Promise<void> => {
      setNotice(undefined);
      const { origin, pathname } = globalThis.location;
      setNotice(
        await shareModel(
          modelStore.getState().present,
          `${origin}${pathname}`,
          links,
        ),
      );
    };
    void run();
  }, [links]);

  const dismissNotice = useCallback((): void => {
    setNotice(undefined);
  }, []);

  const confirm = useCallback((): void => {
    settle(true);
  }, [settle]);

  const cancel = useCallback((): void => {
    settle(false);
  }, [settle]);

  return useMemo(
    () => ({ share, notice, dismissNotice, asking, confirm, cancel }),
    [asking, cancel, confirm, dismissNotice, notice, share],
  );
}

async function encodedLink(
  model: Model,
  base: string,
  links: ShareLinks,
): Promise<Either.Either<string, LinkFailure>> {
  const module = await links.module();
  if (Either.isLeft(module)) {
    return Either.left(LinkFailure.Module({ failure: module.left }));
  }
  return Either.mapLeft(
    await writeShareLink(model, base, module.right),
    (failure) => LinkFailure.Codec({ failure }),
  );
}

const readFailureTags: Readonly<Record<ReadFailure['_tag'], true>> = {
  ExceededReadLimit: true,
  MalformedText: true,
  InvalidWireDocument: true,
  InvalidModel: true,
};

function linkFailureOf(failure: ShareLinkFailure | ReadFailure): LinkFailure {
  return isReadFailure(failure)
    ? LinkFailure.Read({ failure })
    : LinkFailure.Codec({ failure });
}

function isReadFailure(
  failure: ShareLinkFailure | ReadFailure,
): failure is ReadFailure {
  return Object.hasOwn(readFailureTags, failure._tag);
}

function dropFragment(fragment: string): void {
  const { history, location } = globalThis;
  if (location.hash === fragment) {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
}
