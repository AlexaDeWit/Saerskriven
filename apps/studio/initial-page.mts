import { tokenStylesheet } from '@saerskriven/canvas/tokens';
import { colourModeStorageKey } from './src/theme-preference.js';

/** Script that applies a stored mode before the browser paints the page. */
export const initialColourModeScript = `try {
  const mode = globalThis.localStorage.getItem(${JSON.stringify(colourModeStorageKey)});
  if (mode === 'light' || mode === 'dark') {
    document.documentElement.dataset.saerColourMode = mode;
  }
} catch {}
`;

/** Styles needed before the studio JavaScript mounts the application. */
export const initialPageStylesheet = `${tokenStylesheet}
.initial-page,
.no-script {
  position: fixed;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--saer-space-2);
  background: var(--saer-colour-canvas);
  color: var(--saer-colour-text);
  font-family: var(--saer-font-family);
  font-size: var(--saer-font-size);
}

.no-script {
  margin: 0;
}

.initial-page__indicator {
  width: 2rem;
  height: 2rem;
  border: 0.25rem solid var(--saer-colour-grid);
  border-top-color: var(--saer-colour-accent);
  border-radius: 50%;
  animation: saer-initial-page-spin 0.8s linear infinite;
}

@keyframes saer-initial-page-spin {
  to {
    transform: rotate(1turn);
  }
}

@media (prefers-reduced-motion: reduce) {
  .initial-page__indicator {
    animation: none;
  }
}
`;
