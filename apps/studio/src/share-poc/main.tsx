import { readLimits } from '@saerskriven/formats';
import { Either } from 'effect';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { SharePocReply, SharePocRequest } from './protocol.js';
import { runSharePoc, SharePocFailure } from './run.js';

function SharePoc() {
  const [source, setSource] = useState('');
  const [link, setLink] = useState('');
  const [reply, setReply] = useState<SharePocReply>();
  const [notice, setNotice] = useState('Choose a model or paste its text.');
  const [busy, setBusy] = useState(false);
  const active = useRef<AbortController | undefined>(undefined);
  const started = useRef(false);
  const sourceRevision = useRef(0);

  const run = useCallback(async (request: SharePocRequest): Promise<void> => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setReply(undefined);
    setNotice('Working in a separate worker.');
    const before = performance.now();
    const result = await runSharePoc(request, controller.signal);
    if (active.current !== controller) return;
    active.current = undefined;
    setBusy(false);
    if (Either.isLeft(result)) {
      setNotice(
        SharePocFailure.$match(result.left, {
          Cancelled: () => 'Cancelled.',
          TimedOut: () => 'The worker exceeded its 15-second deadline.',
          Unavailable: ({ reason }) => reason,
          InvalidReply: () => 'The worker returned an invalid response.',
          InvalidRequest: () => 'The request exceeds an input limit.',
        }),
      );
      return;
    }
    setReply(result.right);
    if (result.right.kind === 'encoded') setLink(result.right.result.link);
    setNotice(
      result.right.kind === 'refused'
        ? result.right.message
        : 'Completed in ' +
            String(Math.round(performance.now() - before)) +
            ' ms.',
    );
  }, []);

  useEffect(() => {
    if (!started.current && globalThis.location.hash.startsWith('#share=')) {
      started.current = true;
      const fragment = globalThis.location.hash;
      globalThis.history.replaceState(null, '', globalThis.location.pathname);
      setLink(fragment);
      void run({ kind: 'decode', fragment });
    }
    return () => {
      active.current?.abort();
    };
  }, [run]);

  const choose = async (file: File | undefined): Promise<void> => {
    const revision = ++sourceRevision.current;
    if (file === undefined) return;
    if (file.size > readLimits.maxTextBytes) {
      setNotice('The file exceeds the 8 MiB input limit.');
      return;
    }
    try {
      const text = await file.text();
      if (sourceRevision.current !== revision) return;
      setSource(text);
      setNotice('Model text loaded.');
    } catch {
      if (sourceRevision.current !== revision) return;
      setNotice('The file could not be read.');
    }
  };

  const fragment = link.includes('#') ? link.slice(link.indexOf('#')) : link;
  return (
    <main>
      <h1>Share-link proof of concept</h1>
      <p>
        This development page compares the current format with compact Brotli
        and Rust PPMd links. Experimental links open on this page.
      </p>
      <label>
        Model file{' '}
        <input
          type="file"
          accept=".yaml,.yml,.json"
          onChange={(event) => {
            void choose(event.currentTarget.files?.[0]);
          }}
        />
      </label>
      <label>
        Source model{' '}
        <textarea
          value={source}
          onChange={(event) => {
            sourceRevision.current += 1;
            setSource(event.currentTarget.value);
          }}
        />
      </label>
      <div className="actions">
        <button
          disabled={busy || source === ''}
          onClick={() => {
            void run({
              kind: 'encode',
              text: source,
              base: globalThis.location.origin + globalThis.location.pathname,
            });
          }}
        >
          Generate link
        </button>
        <button
          disabled={!busy}
          onClick={() => {
            active.current?.abort();
          }}
        >
          Cancel
        </button>
      </div>
      <output>{notice}</output>
      {reply?.kind === 'encoded' && (
        <section aria-label="Size comparison">
          <h2>{reply.title}</h2>
          <dl>
            <dt>Current URL characters</dt>
            <dd>{reply.result.baselineLength}</dd>
            <dt>Selected URL characters</dt>
            <dd>{reply.result.link.length}</dd>
            <dt>Reduction</dt>
            <dd>
              {(
                100 *
                (1 - reply.result.link.length / reply.result.baselineLength)
              ).toFixed(2)}
              %
            </dd>
            <dt>Selected codec</dt>
            <dd>{reply.result.codec}</dd>
          </dl>
          <a href={reply.result.link} target="_blank" rel="noopener noreferrer">
            Open link in a new tab
          </a>
        </section>
      )}
      <label>
        Link to inspect{' '}
        <textarea
          value={link}
          onChange={(event) => {
            setLink(event.currentTarget.value);
          }}
        />
      </label>
      <button
        disabled={busy || link === ''}
        onClick={() => {
          void run({ kind: 'decode', fragment });
        }}
      >
        Inspect link
      </button>
      {reply?.kind === 'decoded' && (
        <section aria-label="Decoded model">
          <h2>{reply.title}</h2>
          <label>
            Decoded YAML <textarea readOnly value={reply.yaml} />
          </label>
        </section>
      )}
    </main>
  );
}

const root = document.getElementById('root');
if (root !== null) createRoot(root).render(<SharePoc />);
