import { ReadFailure } from '@saerskriven/formats';
import {
  catalogueTemplates,
  locales,
  wellFormedTemplate,
} from '@saerskriven/i18n';
import { act, render, screen } from '@testing-library/react';
import { isValidElement } from 'react';
import {
  currentAnnouncement,
  resetAnnouncements,
} from '../canvas/announcements.js';
import {
  createDiagram,
  renameActiveDiagram,
  resetDiagramRenaming,
  showDiagram,
} from '../canvas/diagrams.js';
import { toggleSnap } from '../canvas/snap.js';
import { activeDiagramId } from '../store/selectors.js';
import {
  StudioFailure,
  initialState,
  placeholderModel,
} from '../store/state.js';
import { modelStore } from '../store/store.js';
import { FailureNotice } from '../ui/failure-notice.js';
import { studioCatalogues } from './catalogues.js';
import { activeTranslator, chooseLocale } from './locale.js';
import { Message } from './message.js';

const refusedRead = StudioFailure.Read({
  name: 'broken.json',
  failure: ReadFailure.InvalidWireDocument({
    issues: [
      { path: ['diagrams', 0], message: 'is required', code: 'invalid_type' },
      { path: ['threats', 1], message: 'is required', code: 'invalid_type' },
    ],
  }),
});

afterEach(() => {
  act(() => {
    chooseLocale('en-CA');
  });
  resetAnnouncements();
  resetDiagramRenaming();
});

describe('studio catalogues', () => {
  it('keep every brace inside a placeholder', () => {
    expect(
      catalogueTemplates(studioCatalogues).filter(
        ({ template }) => !wellFormedTemplate(template),
      ),
    ).toEqual([]);
  });

  it('take the browser languages until a locale is chosen', () => {
    expect(activeTranslator().locale).toBe('en-CA');
  });
});

describe.each(locales)('the %s vertical slice', (locale) => {
  beforeEach(() => {
    chooseLocale(locale);
  });

  it('announces outside a component in the locale chosen after load', () => {
    toggleSnap();
    const on = currentAnnouncement().message;
    toggleSnap();

    expect(on).toBe(activeTranslator().t('canvas.snap-on'));
    expect(currentAnnouncement().message).toBe(
      activeTranslator().t('canvas.snap-off'),
    );
  });

  it('interpolates a diagram title as literal text', () => {
    const title = '{title} <b>Main</b>';
    modelStore.setState(initialState(placeholderModel), true);
    const first = activeDiagramId(modelStore.getState());
    createDiagram();
    renameActiveDiagram(title);
    const added = activeDiagramId(modelStore.getState());
    if (first === undefined || added === undefined) {
      throw new Error('the placeholder model shows a diagram');
    }
    showDiagram(first);
    showDiagram(added);

    expect(currentAnnouncement().message).toBe(
      activeTranslator().t('canvas.diagram-shown', { title }),
    );
    expect(currentAnnouncement().message).toContain(title);
  });

  it('renders a label and a plural in a component, following a later change of locale', () => {
    const next = locales[(locales.indexOf(locale) + 1) % locales.length];
    render(<FailureNotice failure={refusedRead} />);

    expect(
      screen.getByRole('button', {
        name: activeTranslator().t('notice.dismiss'),
      }),
    ).toBeDefined();
    expect(
      screen.getByText(
        activeTranslator().t('notice.refusal-details', { count: 2 }),
      ),
    ).toBeDefined();

    act(() => {
      chooseLocale(next);
    });

    expect(
      screen.getByRole('button', {
        name: activeTranslator().t('notice.dismiss'),
      }),
    ).toBeDefined();
    expect(
      screen.getByText(
        activeTranslator().t('notice.refusal-details', { count: 2 }),
      ),
    ).toBeDefined();
  });
});

describe('message components the typecheck refuses', () => {
  const details = 'notice.refusal-details';

  it('refuses a parameter the message does not declare', () => {
    const element = (
      // @ts-expect-error `total` is not the declared `count`
      <Message id={details} params={{ total: 2 }} />
    );
    expect(isValidElement(element)).toBe(true);
  });

  it('refuses a count that is not a number', () => {
    const element = (
      // @ts-expect-error a count is a number
      <Message id={details} params={{ count: '2' }} />
    );
    expect(isValidElement(element)).toBe(true);
  });

  it('refuses an id outside the studio contract', () => {
    const element = (
      // @ts-expect-error `notice.dismissed` is not a message
      <Message id="notice.dismissed" params={{}} />
    );
    expect(isValidElement(element)).toBe(true);
  });
});
