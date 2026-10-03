import { ReadFailure, saerskrivenYamlCodec } from '@saerskriven/formats';
import { brotliUnbuilt, brotliWasm } from '@saerskriven/formats/fixtures';
import {
  ShareLinkFailure,
  shareLinkLimit,
} from '@saerskriven/formats/share-link';
import type { Model } from '@saerskriven/model';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Either } from 'effect';
import { brotliCompressSync } from 'node:zlib';
import { StrictMode } from 'react';
import { AssetFailure } from '../asset-failure.js';
import { recordingClipboard } from '../canvas/canvas.fixtures.js';
import { activeTranslator } from '../messages/locale.js';
import { Action } from '../store/actions.js';
import { RecoveryProblem } from '../store/recovery-storage.js';
import { isDirty } from '../store/selectors.js';
import {
  LinkFailure,
  StudioFailure,
  initialState,
  nameOf,
  type State,
} from '../store/state.js';
import { sampleModel, twoDiagramModel } from '../store/store.fixtures.js';
import { modelStore } from '../store/store.js';
import type { StoreSync } from '../store/sync.js';
import { writeClipboard } from '../system-clipboard.js';
import { useFileSession } from './file-commands.js';
import {
  anotherTab,
  deferred,
  edit,
  fragmentOf,
  paste,
  sampleNativeText,
  specBridge,
  specLinks,
  specRenders,
  visit,
} from './files.fixtures.js';
import { linkLanding, readLink, type ShareLinks } from './share-link.js';
import { describeShareNotice, ShareNotice } from './share-notice.js';

const settled = { timeout: 5_000 };

const shared: Model = {
  ...twoDiagramModel,
  metadata: { ...twoDiagramModel.metadata, title: 'Checkout: payments' },
};

const asRead = (model: Model): Model =>
  Either.getOrThrow(
    saerskrivenYamlCodec.read(saerskrivenYamlCodec.write(model).output),
  ).model;

const holding = (text: string): string =>
  `#share=1.${brotliCompressSync(Buffer.from(text)).toString('base64url')}`;

const session = (
  links: ShareLinks,
  sync: Pick<StoreSync, 'watch'> = anotherTab().sync,
  strict = false,
) =>
  renderHook(() => useFileSession(specBridge(), specRenders(), sync, links), {
    wrapper: strict ? StrictMode : undefined,
  }).result;

const held = (): State => modelStore.getState();

const linkFailure = (): LinkFailure | undefined => {
  const failure = held().lastFailure;
  return StudioFailure.$is('Link')(failure) ? failure.failure : undefined;
};

beforeEach(() => {
  visit('/studio/?pseudo');
  modelStore.setState(initialState(sampleModel), true);
});

afterEach(() => {
  visit('/');
  vi.restoreAllMocks();
});

describe.skipIf(brotliUnbuilt)('a shared link arriving', () => {
  it('loads into a clean session unsaved, named after its title, and leaves the address without its fragment', async () => {
    visit(await fragmentOf(shared));
    const { links } = specLinks();

    session(links);

    await waitFor(() => {
      expect(held().present.metadata.title).toBe('Checkout: payments');
    }, settled);
    expect(held().present).toEqual(asRead(shared));
    expect(isDirty(held())).toBe(true);
    expect(nameOf(held().file)).toBe('Checkout_ payments.yaml');
    expect(globalThis.location.hash).toBe('');
    expect(globalThis.location.pathname).toBe('/studio/');
    expect(globalThis.location.search).toBe('?pseudo');
  });

  it('falls back to the untitled file name for a model whose title leaves nothing', async () => {
    visit(
      await fragmentOf({
        ...shared,
        metadata: { ...shared.metadata, title: ' . ' },
      }),
    );

    session(specLinks().links);

    await waitFor(() => {
      expect(nameOf(held().file)).toBe(
        `${activeTranslator().t('defaults.untitled-file')}.yaml`,
      );
    }, settled);
  });

  it('reads a link pasted into the open tab at hashchange, with no reload', async () => {
    const { links, loads } = specLinks();
    session(links);
    expect(loads).not.toHaveBeenCalled();

    paste(await fragmentOf(shared));

    await waitFor(() => {
      expect(held().present).toEqual(asRead(shared));
    }, settled);
    expect(globalThis.location.hash).toBe('');
  });

  it('lands the later of two pasted links when the earlier finishes reading last', async () => {
    const reads = [
      deferred<Either.Either<Uint8Array, AssetFailure>>(),
      deferred<Either.Either<Uint8Array, AssetFailure>>(),
    ];
    let calls = 0;
    const result = session({
      module: () => {
        const read = reads[calls];
        calls += 1;
        return read?.promise ?? Promise.resolve(Either.right(brotliWasm()));
      },
      copy: writeClipboard,
    });
    const earlier = await fragmentOf(shared);
    const later = await fragmentOf({
      ...shared,
      metadata: { ...shared.metadata, title: 'Later link' },
    });

    paste(earlier);
    paste(later);
    reads[1]?.resolve(Either.right(brotliWasm()));
    await waitFor(() => {
      expect(held().present.metadata.title).toBe('Later link');
    }, settled);
    const landed = held().present;
    await act(async () => {
      reads[0]?.resolve(Either.right(brotliWasm()));
      await reads[0]?.promise;
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(held().present).toBe(landed);
    expect(result.current.linking).toBe(false);
  });

  it('loads none of the module while the address holds no share link', () => {
    const { links, loads } = specLinks();
    visit('#security-properties');

    session(links);
    paste('#notes');

    expect(loads).not.toHaveBeenCalled();
    expect(held().present).toBe(sampleModel);
  });

  it('reads one link once where the effect runs twice', async () => {
    visit(await fragmentOf(shared));
    const { links, loads } = specLinks();
    const replaced = vi.spyOn(globalThis.history, 'replaceState');

    session(links, anotherTab().sync, true);

    await waitFor(() => {
      expect(held().present).toEqual(asRead(shared));
    }, settled);
    expect(loads).toHaveBeenCalledTimes(1);
    expect(replaced).toHaveBeenCalledTimes(1);
  });

  it('puts what the read could not carry in the loss report', async () => {
    visit(holding(`${sampleNativeText}nothingDeclaresThis: kept nowhere\n`));

    const result = session(specLinks().links);

    await waitFor(() => {
      expect(result.current.report?.losses).toHaveLength(1);
    }, settled);
    expect(result.current.report?.occasion).toBe('open');
    expect(result.current.report?.losses[0]?.kept).toBe(false);
  });

  it('lets go of the open file before the link lands, so Save cannot write it over that file', async () => {
    const { links } = specLinks();
    const bridge = specBridge();
    renderHook(() =>
      useFileSession(bridge, specRenders(), anotherTab().sync, links),
    );

    paste(await fragmentOf(shared));

    await waitFor(() => {
      expect(bridge.releases.count).toBe(1);
    }, settled);
  });
});

describe.skipIf(brotliUnbuilt)(
  'a shared link arriving over unsaved work',
  () => {
    it('asks the question rather than loading, while the session holds unsaved changes', async () => {
      const result = session(specLinks().links);
      edit();
      const before = held().present;

      paste(await fragmentOf(shared));

      await waitFor(() => {
        expect(result.current.linking).toBe(true);
      }, settled);
      expect(held().present).toBe(before);
      expect(globalThis.location.hash).not.toBe('');
    });

    it('asks where the recovery snapshot could not be read at startup, with no change on screen', async () => {
      modelStore.setState(
        {
          ...initialState(sampleModel),
          recoveryUnread: true,
          lastFailure: StudioFailure.StoredRecoveryRejected({
            problem: RecoveryProblem.Unsupported(),
          }),
        },
        true,
      );
      visit(await fragmentOf(shared));

      const result = session(specLinks().links);

      await waitFor(() => {
        expect(result.current.linking).toBe(true);
      }, settled);
      expect(held().present).toBe(sampleModel);
    });

    it('loads the link on Discard and removes the fragment', async () => {
      const result = session(specLinks().links);
      edit();
      paste(await fragmentOf(shared));
      await waitFor(() => {
        expect(result.current.linking).toBe(true);
      }, settled);

      act(() => {
        result.current.confirmLink();
      });

      expect(held().present).toEqual(asRead(shared));
      expect(isDirty(held())).toBe(true);
      expect(result.current.linking).toBe(false);
      expect(globalThis.location.hash).toBe('');
    });

    it('keeps the work on Cancel and removes the fragment, so a reload asks nothing', async () => {
      const result = session(specLinks().links);
      edit();
      const before = held().present;
      paste(await fragmentOf(shared));
      await waitFor(() => {
        expect(result.current.linking).toBe(true);
      }, settled);

      act(() => {
        result.current.cancelLink();
      });

      expect(held().present).toBe(before);
      expect(result.current.linking).toBe(false);
      expect(globalThis.location.hash).toBe('');
      expect(globalThis.location.search).toBe('?pseudo');
    });

    it('puts the question away and removes the fragment when another tab changes the model', async () => {
      const other = anotherTab();
      const result = session(specLinks().links, other.sync);
      edit();
      paste(await fragmentOf(shared));
      await waitFor(() => {
        expect(result.current.linking).toBe(true);
      }, settled);

      other.reaches({ ...held(), recoveryCurrent: true });

      expect(result.current.linking).toBe(false);
      expect(globalThis.location.hash).toBe('');
      expect(held().present.metadata.title).not.toBe('Checkout: payments');
    });
  },
);

describe.skipIf(brotliUnbuilt)('a refused link', () => {
  it.each([
    ['cut off', '#share=1.not*base64', 'Codec', 'Malformed'],
    ['in a newer encoding', '#share=2.G2QA', 'Codec', 'UnknownEncoding'],
    ['too long', `#share=1.${'A'.repeat(shareLinkLimit)}`, 'Codec', 'TooLong'],
    [
      'holding no model',
      holding('formatVersion: 2\n'),
      'Read',
      'InvalidWireDocument',
    ],
  ])(
    'shows a link %s as the failure notice, keeping the model and removing the fragment',
    async (_what, fragment, source, cause) => {
      visit(fragment);

      session(specLinks().links);

      await waitFor(() => {
        expect(linkFailure()).toMatchObject({
          _tag: source,
          failure: { _tag: cause },
        });
      }, settled);
      expect(held().present).toBe(sampleModel);
      expect(globalThis.location.hash).toBe('');
    },
  );

  it('shows a module that would not load as the failure notice', async () => {
    visit(await fragmentOf(shared));
    const unavailable = AssetFailure.Unavailable({ reason: 'offline' });

    session(specLinks(() => Promise.resolve(Either.left(unavailable))).links);

    await waitFor(() => {
      expect(linkFailure()).toEqual(
        LinkFailure.Module({ failure: unavailable }),
      );
    }, settled);
  });
});

const shareNotice = async (
  result: ReturnType<typeof session>,
): Promise<ShareNotice> => {
  act(() => {
    result.current.commands.share();
  });
  await waitFor(() => {
    expect(result.current.shareNotice).toBeDefined();
  }, settled);
  const notice = result.current.shareNotice;
  if (notice === undefined) {
    throw new Error('Share reported nothing.');
  }
  return notice;
};

describe.skipIf(brotliUnbuilt)('Share', () => {
  it('puts a link to this page on the clipboard, reporting its length, and the link reads back as the model', async () => {
    const clipboard = recordingClipboard();
    const { links, loads } = specLinks();
    const result = session(links);
    expect(loads).not.toHaveBeenCalled();

    const notice = await shareNotice(result);

    const link = clipboard.text();
    expect(
      link.startsWith(`${globalThis.location.origin}/studio/#share=1.`),
    ).toBe(true);
    expect(notice).toEqual(ShareNotice.Shared({ length: link.length }));
    expect(
      Either.getOrThrow(await readLink(new URL(link).hash, links)).model,
    ).toEqual(asRead(sampleModel));
  });

  it('asks for the clipboard write as Share runs, before the link is written, so the press that ran it holds for the write', async () => {
    recordingClipboard();
    const module = deferred<Either.Either<Uint8Array, AssetFailure>>();
    const copy = vi.fn<ShareLinks['copy']>(writeClipboard);
    const result = session({ module: () => module.promise, copy });

    act(() => {
      result.current.commands.share();
    });

    expect(copy).toHaveBeenCalledTimes(1);
    module.resolve(Either.right(brotliWasm()));
    await waitFor(() => {
      expect(result.current.shareNotice?._tag).toBe('Shared');
    }, settled);
  });

  it('refuses a link past the ceiling, pointing to Save, and leaves the clipboard alone', async () => {
    const clipboard = recordingClipboard();
    visit(`/${'x'.repeat(shareLinkLimit)}`);

    const notice = await shareNotice(session(specLinks().links));

    expect(notice).toMatchObject({
      _tag: 'Refused',
      failure: {
        _tag: 'Codec',
        failure: { _tag: 'TooLong', limit: shareLinkLimit },
      },
    });
    expect(describeShareNotice(activeTranslator().t, notice).headline).toBe(
      activeTranslator().t('reports.share-too-large'),
    );
    expect(clipboard.text()).toBe('existing clipboard');
  });

  it('reports the text the browser refused the clipboard write with', async () => {
    const clipboard = recordingClipboard();
    clipboard.writeText.mockRejectedValueOnce(
      new Error('Document is not focused.'),
    );

    const notice = await shareNotice(session(specLinks().links));

    expect(notice).toEqual(
      ShareNotice.ClipboardRefused({ reason: 'Document is not focused.' }),
    );
  });

  it('refuses where the module would not load', async () => {
    recordingClipboard();
    const answered = AssetFailure.Answered({
      url: '/brotli.wasm',
      status: 404,
    });

    const notice = await shareNotice(
      session(specLinks(() => Promise.resolve(Either.left(answered))).links),
    );

    expect(notice).toEqual(
      ShareNotice.Refused({
        failure: LinkFailure.Module({ failure: answered }),
      }),
    );
  });
});

describe('the action a link lands with', () => {
  it('opens the link as its own action, named after the title, rather than as an import', () => {
    expect(
      linkLanding({ model: shared, divergences: [] }, 'threat-model'),
    ).toEqual(
      Action.LinkOpened({ model: shared, name: 'Checkout_ payments.yaml' }),
    );
  });
});

describe('a share notice', () => {
  it('says who can read the link it reports, under its length', () => {
    const { t } = activeTranslator();

    expect(
      describeShareNotice(t, ShareNotice.Shared({ length: 18_044 })),
    ).toEqual({
      headline: t('reports.shared', { length: 18_044 }),
      details: [t('reports.shared-disclosure')],
    });
  });

  it('points to Save for a model too large for any link, and not for a module that failed', () => {
    const { t } = activeTranslator();
    const headline = (failure: LinkFailure): string =>
      describeShareNotice(t, ShareNotice.Refused({ failure })).headline;

    expect(
      headline(
        LinkFailure.Codec({
          failure: ShareLinkFailure.PastReadBound({ size: 9_000_000 }),
        }),
      ),
    ).toBe(t('reports.share-too-large'));
    expect(
      headline(
        LinkFailure.Codec({
          failure: ShareLinkFailure.Unusable({ sentence: 'trapped' }),
        }),
      ),
    ).toBe(t('reports.share-refused'));
    expect(
      headline(
        LinkFailure.Read({
          failure: ReadFailure.MalformedText({ message: 'not YAML' }),
        }),
      ),
    ).toBe(t('reports.share-refused'));
  });
});
