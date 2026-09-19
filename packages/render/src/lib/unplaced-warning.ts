import type { UnplacedEndpoint } from '@saerskriven/canvas';
import type { Locale } from '@saerskriven/i18n';
import { exportText } from '../messages/catalogues.js';

/**
 * The warning, in `locale`'s words, for flow endpoints a projection could not
 * place: a headline, then one indented line per endpoint with its flow and
 * element ids in JSON quotes. Empty when every endpoint was placed.
 */
export function renderUnplacedWarning(
  unplaced: readonly UnplacedEndpoint[],
  locale: Locale,
): string {
  const { t } = exportText(locale);
  return unplaced.length > 0
    ? [
        t('warning.unplaced'),
        ...unplaced.map(
          (endpoint) =>
            `  ${t(
              endpoint.side === 'source'
                ? 'warning.unplaced-source'
                : 'warning.unplaced-target',
              {
                flow: quoted(endpoint.flow),
                element: quoted(endpoint.element),
              },
            )}`,
        ),
        '',
      ].join('\n')
    : '';
}

function quoted(value: string): string {
  return JSON.stringify(value);
}
