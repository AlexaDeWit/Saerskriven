import { isEmptyName } from '@saerskriven/model';
import type { Speaker } from './said.js';

/** Uses the locale's fallback without changing a stored blank title. */
export function diagramTitle(title: string, t: Speaker): string {
  return isEmptyName(title) ? t('defaults.untitled-diagram') : title;
}
