import { render, screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { useEffect, useMemo } from 'react';
import {
  CommandSurfaceProvider,
  unmountedSurface,
} from '../commands/binding.js';
import type { RenderExports } from './export-commands.js';
import { useFileSession } from './file-commands.js';
import { FileReports } from './file-reports.js';
import type { SpecBridge } from './files.fixtures.js';
import { StudioMenu } from './menu.js';
import type { ShareLinks } from './share-link.js';

export type User = ReturnType<typeof userEvent.setup>;

/** The burger button, under either of its names. */
export const burger = (): HTMLElement =>
  screen.getByRole('button', { name: /^Menu/u });

export const item = (name: string | RegExp): HTMLElement =>
  screen.getByRole('menuitem', { name });

/** Opens the menu only when it is closed. */
export const openMenu = async (user: User): Promise<void> => {
  if (screen.queryByRole('menu') === null) {
    await user.click(burger());
    await screen.findByRole('menu');
  }
};

export const choose = async (
  user: User,
  name: string | RegExp,
): Promise<void> => {
  await openMenu(user);
  await user.click(item(name));
};

/**
 * The burger menu and the reports under it, over a session on `bridge`,
 * with the file commands mounted as the command surface. `runs: 'pdf'` starts
 * a PDF export as it mounts.
 */
export function Menu({
  bridge,
  runs,
  renders,
  links,
}: {
  readonly bridge: SpecBridge;
  readonly runs?: 'pdf';
  readonly renders?: RenderExports;
  readonly links?: ShareLinks;
}) {
  const session = useFileSession(bridge, renders, undefined, links);
  useEffect(() => {
    if (runs === 'pdf') {
      session.commands.exportPdf();
    }
  }, [runs, session.commands]);
  const surface = useMemo(
    () => ({ ...unmountedSurface, files: session.commands }),
    [session.commands],
  );
  return (
    <CommandSurfaceProvider surface={surface}>
      <StudioMenu session={session} />
      <FileReports session={session} />
    </CommandSurfaceProvider>
  );
}

export const mounted = (
  bridge: SpecBridge,
  renders?: RenderExports,
  runs?: 'pdf',
  links?: ShareLinks,
): void => {
  render(<Menu bridge={bridge} links={links} renders={renders} runs={runs} />);
};
