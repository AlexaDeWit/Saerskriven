import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isDirty } from '../store/selectors.js';
import { initialState, nameOf } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { sampleModel } from '../store/store.fixtures.js';
import { OpenOutcome, type ChosenFile } from './bridge.js';
import {
  chosenFile,
  edit,
  sampleNativeText,
  specBridge,
  vendoredFile,
} from './files.fixtures.js';
import { item, mounted, openMenu, type User } from './menu.fixtures.js';

const recentFiles = 'Recent files';

const clearRecent = 'Clear recent files';

const native = (name: string): ChosenFile => chosenFile(name, sampleNativeText);

const unavailable = (): boolean =>
  item(recentFiles).getAttribute('aria-disabled') === 'true';

const openRecent = async (user: User): Promise<void> => {
  await openMenu(user);
  await waitFor(() => {
    expect(unavailable()).toBe(false);
  });
  await user.hover(item(recentFiles));
  await screen.findByRole('menuitem', { name: clearRecent });
};

const listed = (): readonly string[] =>
  within(screen.getByRole('menu', { name: recentFiles }))
    .getAllByRole('menuitem')
    .map((entry) => entry.textContent);

const openThrough = async (user: User, opened: string): Promise<void> => {
  await openMenu(user);
  await user.click(item('Open'));
  await waitFor(() => {
    expect(nameOf(modelStore.getState().file, '')).toBe(opened);
  });
};

const openedFile = (): string | undefined => {
  const { file } = modelStore.getState();
  return file._tag === 'Opened' ? nameOf(file, '') : undefined;
};

beforeEach(() => {
  modelStore.setState(initialState(sampleModel), true);
});

afterEach(() => {
  globalThis.localStorage.clear();
});

describe('the Recent files submenu', () => {
  it('is not offered where the browser keeps no reference to a file', async () => {
    const user = userEvent.setup();
    mounted(specBridge());

    await openMenu(user);

    expect(screen.queryByRole('menuitem', { name: recentFiles })).toBeNull();
  });

  it('follows Open and lists files by name, most recent first, then Clear recent files', async () => {
    const user = userEvent.setup();
    mounted(
      specBridge({ recent: [native('newer.yaml'), native('older.yaml')] }),
    );

    await openRecent(user);

    const rows = screen.getAllByRole('menuitem');
    expect(rows.indexOf(item(recentFiles))).toBe(
      rows.indexOf(item('Open')) + 1,
    );
    expect(listed()).toEqual(['newer.yaml', 'older.yaml', clearRecent]);
  });

  it('is unavailable while the list is empty', async () => {
    const user = userEvent.setup();
    mounted(specBridge({ recent: [] }));

    await openMenu(user);
    await waitFor(() => {
      expect(unavailable()).toBe(true);
    });
  });

  it('opens the file chosen, as Open does', async () => {
    const user = userEvent.setup();
    mounted(specBridge({ recent: [native('model.yaml')] }));

    await openRecent(user);
    await user.click(item('model.yaml'));

    await waitFor(() => {
      expect(openedFile()).toBe('model.yaml');
    });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('asks before replacing unsaved work, naming the file, and opens it on the second press', async () => {
    const user = userEvent.setup();
    mounted(specBridge({ recent: [native('model.yaml')] }));
    edit();

    await openRecent(user);
    await user.click(item('model.yaml'));

    expect(item('Discard changes and open model.yaml')).toBeDefined();
    expect(item('Cancel')).toBeDefined();
    expect(openedFile()).toBeUndefined();

    await user.click(item('Discard changes and open model.yaml'));

    await waitFor(() => {
      expect(openedFile()).toBe('model.yaml');
    });
    expect(isDirty(modelStore.getState())).toBe(false);
  });

  it('keeps the unsaved work on Cancel, and puts the question away', async () => {
    const user = userEvent.setup();
    mounted(specBridge({ recent: [native('model.yaml')] }));
    edit();

    await openRecent(user);
    await user.click(item('model.yaml'));
    await user.click(item('Cancel'));

    expect(isDirty(modelStore.getState())).toBe(true);
    await openRecent(user);
    expect(listed()).toEqual(['model.yaml', clearRecent]);
  });

  it('drops a file that is gone, under a notice naming it', async () => {
    const user = userEvent.setup();
    mounted(
      specBridge({
        recent: [native('moved.yaml')],
        reopens: OpenOutcome.Gone({ name: 'moved.yaml' }),
      }),
    );

    await openRecent(user);
    await user.click(item('moved.yaml'));

    await waitFor(() => {
      expect(screen.getByTestId('failure-notice').textContent).toContain(
        'moved.yaml',
      );
    });
    await openMenu(user);
    await waitFor(() => {
      expect(unavailable()).toBe(true);
    });
  });

  it('keeps a file whose permission was declined, and opens nothing', async () => {
    const user = userEvent.setup();
    mounted(
      specBridge({
        recent: [native('model.yaml')],
        reopens: OpenOutcome.Declined(),
      }),
    );

    await openRecent(user);
    await user.click(item('model.yaml'));
    await openRecent(user);

    expect(listed()).toEqual(['model.yaml', clearRecent]);
    expect(openedFile()).toBeUndefined();
    expect(screen.getByTestId('failure-notice').textContent).toBe('');
  });

  it('empties the list on Clear recent files', async () => {
    const user = userEvent.setup();
    mounted(specBridge({ recent: [native('a.yaml'), native('b.yaml')] }));

    await openRecent(user);
    await user.click(item(clearRecent));

    await openMenu(user);
    await waitFor(() => {
      expect(unavailable()).toBe(true);
    });
  });

  it.each([
    ['Saerskriven YAML', native('model.yaml')],
    ['Threat Dragon', vendoredFile('threat-dragon/feature-complete.json')],
  ] as const)('lists a file Open read as %s', async (_, offers) => {
    const user = userEvent.setup();
    mounted(specBridge({ offers, recent: [] }));

    await openThrough(user, offers.name);
    await openRecent(user);

    expect(listed()).toEqual([offers.name, clearRecent]);
  });

  it('leaves out a file Open imported from OTM, which Saerskriven does not write', async () => {
    const user = userEvent.setup();
    mounted(
      specBridge({ offers: vendoredFile('otm/example.json'), recent: [] }),
    );

    await openThrough(user, 'example.yaml');
    await openMenu(user);

    await waitFor(() => {
      expect(unavailable()).toBe(true);
    });
  });
});
