import { render } from '@testing-library/react';
import { withLanguage } from '../messages/locale.fixtures.js';
import { actorElement } from '../store/store.fixtures.js';
import { modelStore } from '../store/store.js';
import { button, noop } from '../ui/ui.fixtures.js';
import { openCanvas } from './canvas.fixtures.js';
import { GeometryEditor } from './geometry-editor.js';

describe.each([
  [
    'fr-CA',
    ['Diminuer X', 'Augmenter X', 'Diminuer Y', 'Augmenter Y'],
    [
      'Diminuer la largeur',
      'Augmenter la largeur',
      'Diminuer la hauteur',
      'Augmenter la hauteur',
    ],
  ],
  [
    'sv',
    ['Minska X', 'Öka X', 'Minska Y', 'Öka Y'],
    ['Minska bredden', 'Öka bredden', 'Minska höjden', 'Öka höjden'],
  ],
] as const)('GeometryEditor in %s', (locale, axes, extents) => {
  withLanguage(locale);

  it('names the steppers of an axis by its letter, and those of the width and the height as phrases', () => {
    openCanvas([actorElement]);
    render(<GeometryEditor state={modelStore.getState()} close={noop} />);

    for (const name of [...axes, ...extents]) {
      expect(button(name)).toBeDefined();
    }
  });
});
