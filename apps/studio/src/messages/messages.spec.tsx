import { ReadFailure } from '@saerskriven/formats';
import { locales } from '@saerskriven/i18n';
import type { Severity } from '@saerskriven/model';
import { act, render, screen } from '@testing-library/react';
import { isValidElement } from 'react';
import { commands } from '../commands/registry.js';
import { shortcutLabelText } from '../commands/shortcuts.js';
import { chooseFrom } from '../panel/panel.fixtures.js';
import { SeverityField } from '../ui/severity-field.js';
import { listboxTimeout } from '../ui/ui.fixtures.js';
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
import { copySelected } from '../canvas/clipboard.js';
import { describeRemoval } from '../canvas/edits.js';
import { toggleSnap } from '../canvas/snap.js';
import { numbersIn } from '../ui/ui.fixtures.js';
import { activeDiagramId } from '../store/selectors.js';
import {
  StudioFailure,
  initialState,
  placeholderModel,
} from '../store/state.js';
import { modelStore } from '../store/store.js';
import { FailureNotice } from '../ui/failure-notice.js';
import { activeTranslator, chooseLanguage } from './locale.js';
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
    chooseLanguage('en-CA');
  });
  resetAnnouncements();
  resetDiagramRenaming();
});

describe.each(locales)('the %s vertical slice', (locale) => {
  beforeEach(() => {
    chooseLanguage(locale);
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

  it('announces a refused copy outside a component in the chosen locale', async () => {
    modelStore.setState(initialState(placeholderModel), true);

    await copySelected();

    expect(currentAnnouncement().message).toBe(
      activeTranslator().t('canvas.copy-nothing-selected'),
    );
  });

  it('counts a removal at zero, one and many, choosing the plural form by count', () => {
    const { t } = activeTranslator();
    const removal = (count: number): string =>
      describeRemoval(t, { count }, { flows: count, threats: count });

    for (const count of [0, 1, 5]) {
      expect(numbersIn(removal(count))).toEqual([count, count, count]);
    }
    expect(removal(1)).not.toBe(removal(2).replaceAll('2', '1'));
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
      chooseLanguage(next);
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

describe.each(locales)('a %s reader', (locale) => {
  beforeEach(() => {
    chooseLanguage(locale);
  });

  it('names every command and the context it runs in', () => {
    const { t } = activeTranslator();

    for (const command of commands) {
      expect(shortcutLabelText(command.label, t)).not.toBe('');
      expect(t(command.when)).not.toBe('');
    }
  });
});

describe.each(locales)(
  'a field a %s reader commits',
  (locale) => {
    beforeEach(() => {
      chooseLanguage(locale);
    });

    it('carries the stored value of the option chosen under its label', async () => {
      const onCommit = vi.fn<(severity: Severity) => void>();
      render(<SeverityField onCommit={onCommit} value="high" />);

      await chooseFrom(
        activeTranslator().t('fields.severity'),
        activeTranslator().t('terms.severity-critical'),
      );

      expect(onCommit).toHaveBeenCalledWith('critical');
    });
  },
  listboxTimeout,
);

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
