import { elementId } from '@saerskriven/model/fixtures';
import { exportText } from '../messages/catalogues.js';
import { translatedLocales } from '../render.fixtures.js';
import { renderUnplacedWarning } from './unplaced-warning.js';

const unplaced = [
  { flow: elementId('flow-2'), side: 'target', element: elementId('flow-1') },
] as const;

describe('renderUnplacedWarning', () => {
  it('writes the endpoint lines used by every projection caller', () => {
    expect(renderUnplacedWarning(unplaced, 'en-CA')).toBe(
      'warning: a flow endpoint names an element the canvas draws as no box, so its flow is not in the drawing.\n' +
        '  flow "flow-2" target names "flow-1"\n',
    );
  });

  it('writes nothing when the projection placed every endpoint', () => {
    expect(renderUnplacedWarning([], 'en-CA')).toBe('');
  });

  it.each(translatedLocales)(
    'words the warning in %s around the ids as written',
    (locale) => {
      const [headline, endpoint] = renderUnplacedWarning(
        unplaced,
        locale,
      ).split('\n');
      expect(headline).toBe(exportText(locale).t('warning.unplaced'));
      expect(endpoint).toContain('"flow-2"');
      expect(endpoint).toContain('"flow-1"');
    },
  );
});
