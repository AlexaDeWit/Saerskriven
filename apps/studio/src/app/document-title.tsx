import { useEffect } from 'react';
import { useTranslator } from '../messages/locale.js';
import { showingPlaceholder, windowTitle } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';

/** Names the tab after the landing page or the model on screen. */
export function DocumentTitle() {
  const { t } = useTranslator();
  const untitled = t('defaults.untitled-model');
  const named = useModelStore((state) =>
    showingPlaceholder(state) ? undefined : windowTitle(state, untitled),
  );
  const title = named ?? t('shell.landing-title');

  useEffect(() => {
    document.title = title;
  }, [title]);

  return null;
}
