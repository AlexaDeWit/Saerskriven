import type { Model, Threat } from '@saerskriven/model';
import { softHyphen, threatId } from '@saerskriven/model/fixtures';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  currentAnnouncement,
  resetAnnouncements,
} from '../canvas/announcements.js';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { commandById, runCommand } from '../commands/registry.js';
import { severityMessages, statusMessages } from '../messages/enum-labels.js';
import { activeTranslator } from '../messages/locale.js';
import { Action } from '../store/actions.js';
import { activeDiagramId } from '../store/selectors.js';
import { initialState } from '../store/state.js';
import {
  firstThreat,
  otherElement,
  secondDiagram,
  storeElement,
  twoDiagramModel,
} from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import { detailsTab, numbersIn, threatsTab } from '../ui/ui.fixtures.js';
import { markedWithin } from './marked.js';
import { editorTimeout, listedThreats } from './panel.fixtures.js';
import { ThreatOverlay } from './threat-overlay.js';
import panelStyles from './threat-panel.module.css';
import { resetThreatRegister } from './threat-register-state.js';
import { ThreatRegister } from './threat-register.js';

const looseThreat = threatId('threat-loose');

const mitigatedThreat = threatId('threat-mitigated');

const base = twoDiagramModel.threats[0];

const registerModel: Model = {
  ...twoDiagramModel,
  threats: [
    ...twoDiagramModel.threats,
    {
      ...base,
      id: looseThreat,
      number: 2,
      title: 'A substituted dependency reaches the build',
      severity: 'high',
      elements: [],
    },
    {
      ...base,
      id: mitigatedThreat,
      number: 3,
      title: 'A model file is read past its bounds',
      severity: 'critical',
      status: 'mitigated',
      elements: [storeElement, otherElement],
    },
  ],
  lastIssuedThreatNumber: 3,
};

const reviewed = [looseThreat, firstThreat, mitigatedThreat];

const register = (): HTMLElement =>
  screen.getByRole('region', { name: 'Threat register' });

const modelPanel = (): HTMLElement =>
  screen.getByRole('region', { name: 'Model' });

const rowOf = (id: Threat['id']): HTMLTableRowElement => {
  const row = markedWithin(register(), 'registerRow', id);
  if (!(row instanceof HTMLTableRowElement)) {
    throw new TypeError(`no row for ${id}`);
  }
  return row;
};

const chooser = (id: Threat['id']): HTMLElement =>
  within(rowOf(id)).getAllByRole('button')[0];

const listedRows = (): readonly (string | undefined)[] =>
  listedThreats(register(), 'registerRow');

const modelSummary = (title: RegExp): HTMLElement =>
  within(modelPanel()).getByRole('button', { name: title });

const refuseADraft = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> => {
  const description = within(modelPanel()).getByRole('textbox', {
    name: 'Description',
  });
  await user.click(description);
  await user.keyboard(`Pasted${softHyphen}prose`);
  await user.click(screen.getByRole('button', { name: 'Opener' }));
  expect(description.getAttribute('aria-invalid')).toBe('true');
  resetAnnouncements();
  return description;
};

const hideModelPanel = (): void => {
  act(() => {
    dispatch(Action.HideModelPanel());
  });
};

const showStudio = (): void => {
  render(
    <>
      <button type="button">Opener</button>
      <ThreatRegister cover={0} />
      <ThreatOverlay />
    </>,
  );
};

const openRegister = (): void => {
  act(() => {
    runCommand(commandById('threat-register'), recordingSurface().surface);
  });
};

const landedAt = (): (() => readonly number[]) => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function drawn(this: Element) {
      const top =
        this instanceof HTMLElement &&
        this.dataset['threatItem'] === mitigatedThreat
          ? 300
          : this.classList.contains(panelStyles.body)
            ? 100
            : 0;
      return DOMRect.fromRect({ x: 0, y: top, width: 100, height: 20 });
    },
  );
  const scrolled = vi.spyOn(Element.prototype, 'scrollTop', 'set');
  return () =>
    scrolled.mock.calls
      .filter((_, call) => {
        const scroller: unknown = scrolled.mock.contexts[call];
        return (
          scroller instanceof Element &&
          scroller.classList.contains(panelStyles.body)
        );
      })
      .map(([value]) => value);
};

describe(
  'the threat register',
  () => {
    beforeEach(() => {
      modelStore.setState(initialState(registerModel), true);
      resetThreatRegister();
      resetAnnouncements();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('opens on R with focus on its first row, opening no panel and leaving the model alone', () => {
      showStudio();
      const before = modelStore.getState();

      openRegister();

      expect(register()).toBeDefined();
      expect(document.activeElement).toBe(chooser(looseThreat));
      expect(modelStore.getState()).toBe(before);
    });

    it('is a table of every threat in review order, under number, title, elements, severity and status', () => {
      showStudio();
      openRegister();

      const table = within(register()).getByRole('table', {
        name: /^Threat register \d+$/u,
      });
      expect(within(table).getAllByRole('columnheader')).toEqual(
        ['Number', 'Title', 'Elements', 'Severity', 'Status'].map((name) =>
          within(table).getByRole('columnheader', { name }),
        ),
      );
      expect(listedRows()).toEqual(reviewed);
      expect(numbersIn(rowOf(mitigatedThreat).cells[0].textContent)).toEqual([
        3,
      ]);
      expect(
        within(rowOf(mitigatedThreat)).getByRole('button', {
          name: 'A model file is read past its bounds',
        }),
      ).toBe(chooser(mitigatedThreat));
    });

    it('reads No element for a threat on no element, and names the elements of every other', () => {
      const { t } = activeTranslator();
      showStudio();
      openRegister();

      expect(rowOf(looseThreat).cells[2].textContent).toBe(
        t('panel.no-element'),
      );
      expect(within(rowOf(looseThreat)).getAllByRole('button')).toHaveLength(1);
      expect(
        within(rowOf(mitigatedThreat))
          .getAllByRole('button')
          .slice(1)
          .map((link) => link.textContent),
      ).toEqual(['Models', 'Other reader']);
    });

    it("opens a chosen row's threat on the model panel's Threats tab, landed at the top, and marks the row with focus left on it", async () => {
      const user = userEvent.setup();
      const landed = landedAt();
      showStudio();
      openRegister();

      await user.click(chooser(mitigatedThreat));

      expect(threatsTab().getAttribute('aria-selected')).toBe('true');
      expect(
        modelSummary(/A model file is read past its bounds/u).getAttribute(
          'aria-expanded',
        ),
      ).toBe('true');
      await waitFor(() => {
        expect(landed()).toContain(200);
      });
      expect(register()).toBeDefined();
      expect(chooser(mitigatedThreat).getAttribute('aria-current')).toBe(
        'true',
      );
      expect(chooser(looseThreat).getAttribute('aria-current')).toBeNull();
      expect(document.activeElement).toBe(chooser(mitigatedThreat));
      expect(numbersIn(currentAnnouncement().message)).toEqual([3]);
    });

    it('moves the open model panel from Details to Threats and from one open threat to the chosen one, landed at the top', async () => {
      const user = userEvent.setup();
      const landed = landedAt();
      showStudio();
      openRegister();
      await user.click(chooser(looseThreat));
      await user.click(detailsTab());
      const body = modelPanel().querySelector(`.${panelStyles.body}`);
      if (body !== null) {
        body.scrollTop = 0;
      }

      await user.click(chooser(mitigatedThreat));

      expect(threatsTab().getAttribute('aria-selected')).toBe('true');
      expect(
        modelSummary(/A substituted dependency/u).getAttribute('aria-expanded'),
      ).toBe('false');
      await waitFor(() => {
        expect(landed().at(-1)).toBe(200);
      });
      expect(
        modelSummary(/A model file is read past its bounds/u).getAttribute(
          'aria-expanded',
        ),
      ).toBe('true');
      expect(chooser(mitigatedThreat).getAttribute('aria-current')).toBe(
        'true',
      );
      expect(chooser(looseThreat).getAttribute('aria-current')).toBeNull();
    });

    it('selects an element on another diagram from its name, closing the register', async () => {
      const user = userEvent.setup();
      showStudio();
      openRegister();

      await user.click(
        within(rowOf(mitigatedThreat)).getByRole('button', {
          name: 'Other reader',
        }),
      );

      expect(screen.queryByRole('region', { name: 'Threat register' })).toBe(
        null,
      );
      expect(modelStore.getState().selection).toEqual([otherElement]);
      expect(activeDiagramId(modelStore.getState())).toBe(secondDiagram);
      expect(
        screen.getByRole('heading', { name: 'Other reader' }),
      ).toBeDefined();
    });

    it('closes on Escape and leaves the model panel open, with focus on the threat it opened', async () => {
      const user = userEvent.setup();
      showStudio();
      openRegister();
      await user.click(chooser(mitigatedThreat));

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('region', { name: 'Threat register' })).toBe(
        null,
      );
      expect(modelStore.getState().modelPanel).toBe(true);
      expect(document.activeElement).toBe(
        modelSummary(/A model file is read past its bounds/u),
      );
    });

    it('closes on Close, and hands focus back to where it was where no model panel shows', async () => {
      const user = userEvent.setup();
      showStudio();
      screen.getByRole('button', { name: 'Opener' }).focus();
      openRegister();

      await user.click(
        within(register()).getByRole('button', {
          name: 'Close threat register',
        }),
      );

      expect(screen.queryByRole('region', { name: 'Threat register' })).toBe(
        null,
      );
      expect(modelStore.getState().modelPanel).toBe(false);
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Opener' }),
      );
    });

    it('takes focus back to the chosen row on R while it is open', async () => {
      const user = userEvent.setup();
      showStudio();
      openRegister();
      await user.click(chooser(looseThreat));
      screen.getByRole('button', { name: 'Opener' }).focus();

      openRegister();

      expect(document.activeElement).toBe(chooser(looseThreat));
    });

    it('holds its rows where they opened while the model changes, and takes a new threat at the end', () => {
      showStudio();
      openRegister();

      act(() => {
        dispatch(
          Action.ReplaceThreat({
            threat: { ...registerModel.threats[2], status: 'open' },
          }),
        );
        dispatch(
          Action.AddThreat({
            threat: {
              ...base,
              id: threatId('threat-added'),
              number: 4,
              title: 'An added threat',
              severity: 'critical',
            },
          }),
        );
      });

      expect(listedRows()).toEqual([...reviewed, 'threat-added']);
      expect(
        rowOf(mitigatedThreat)
          .querySelector('[data-status]')
          ?.getAttribute('data-status'),
      ).toBe('open');
      expect(
        numbersIn(within(register()).getByRole('heading').textContent),
      ).toEqual([4]);
    });

    it('takes focus to a chosen row on a click, which Safari and Firefox leave unfocused', () => {
      showStudio();
      openRegister();

      fireEvent.click(chooser(mitigatedThreat));

      expect(document.activeElement).toBe(chooser(mitigatedThreat));
    });

    it('reads a severity and a status as their values alone, under the headers that name them', () => {
      const { t } = activeTranslator();
      showStudio();
      openRegister();

      const cells = rowOf(looseThreat).cells;
      expect(cells[3].textContent).toBe(t(severityMessages.high));
      expect(cells[4].textContent).toBe(t(statusMessages.open));
    });

    it('names the row of a threat with no title by its number', () => {
      modelStore.setState(
        initialState({
          ...registerModel,
          threats: [
            ...registerModel.threats,
            {
              ...base,
              id: threatId('threat-untitled'),
              number: 4,
              title: '',
            },
          ],
          lastIssuedThreatNumber: 4,
        }),
        true,
      );
      showStudio();
      openRegister();

      expect(within(register()).getByRole('button', { name: 'Threat 4' })).toBe(
        chooser(threatId('threat-untitled')),
      );
    });

    it('leaves a threat holding a refused draft open in the model panel, and the row chosen meanwhile unmarked and unannounced', async () => {
      const user = userEvent.setup();
      showStudio();
      openRegister();
      await user.click(chooser(looseThreat));
      await refuseADraft(user);

      await user.click(chooser(mitigatedThreat));

      expect(
        modelSummary(/A substituted dependency/u).getAttribute('aria-expanded'),
      ).toBe('true');
      expect(
        modelSummary(/A model file is read past its bounds/u).getAttribute(
          'aria-expanded',
        ),
      ).toBe('false');
      expect(chooser(mitigatedThreat).getAttribute('aria-current')).toBeNull();
      expect(currentAnnouncement().message).toBe('');
    });

    it("opens the model panel on a retained refused draft rather than a row chosen while it was hidden, and on the draft's own threat where that is the row", async () => {
      const user = userEvent.setup();
      showStudio();
      openRegister();
      await user.click(chooser(looseThreat));
      await refuseADraft(user);
      hideModelPanel();

      await user.click(chooser(mitigatedThreat));

      expect(
        modelSummary(/A substituted dependency/u).getAttribute('aria-expanded'),
      ).toBe('true');
      expect(
        modelSummary(/A model file is read past its bounds/u).getAttribute(
          'aria-expanded',
        ),
      ).toBe('false');
      expect(chooser(mitigatedThreat).getAttribute('aria-current')).toBeNull();
      expect(currentAnnouncement().message).toBe('');

      hideModelPanel();
      await user.click(chooser(looseThreat));

      expect(
        within(modelPanel())
          .getByRole('textbox', { name: 'Description' })
          .getAttribute('aria-invalid'),
      ).toBe('true');
      expect(numbersIn(currentAnnouncement().message)).toEqual([2]);
    });

    it('says so where the model holds no threat, with focus on Close', () => {
      modelStore.setState(
        initialState({ ...registerModel, threats: [] }),
        true,
      );
      showStudio();

      openRegister();

      expect(within(register()).queryByRole('table')).toBeNull();
      expect(
        within(register()).getByText(
          activeTranslator().t('panel.no-model-threats'),
        ),
      ).toBeDefined();
      expect(document.activeElement).toBe(
        within(register()).getByRole('button', {
          name: 'Close threat register',
        }),
      );
    });
  },
  editorTimeout,
);
