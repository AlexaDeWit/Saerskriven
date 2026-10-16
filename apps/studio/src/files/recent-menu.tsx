import { DropdownMenu } from 'radix-ui';
import { Fragment, useEffect } from 'react';
import { useTranslator } from '../messages/locale.js';
import { MenuItem } from './menu-items.js';
import styles from './menu.module.css';
import type { RecentFiles } from './recent-files.js';
import { Submenu } from './submenu.js';

type RecentMenuProps = {
  readonly recent: RecentFiles;
  readonly unsaved: boolean;
};

/**
 * Recent files, each by its name, then Clear recent files, read again each
 * time the menu opens, and unavailable while the list is empty. Over unsaved
 * work a file's item turns into the question Open asks, naming the file, with
 * Cancel under it, and a second press opens the file.
 */
export function RecentMenu({ recent, unsaved }: RecentMenuProps) {
  const { t } = useTranslator();
  const { asking, cancel, clear, files, proceed, refresh, reopen } = recent;

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Submenu
      disabled={files.length === 0}
      trigger={<span>{t('menu.recent-files')}</span>}
    >
      {files.map((file) => {
        const asked = unsaved && asking?.key === file.key;
        return (
          <Fragment key={file.key}>
            <MenuItem
              keepOpen={unsaved && !asked}
              onChoose={() => {
                if (asked) {
                  proceed(file);
                  return;
                }
                reopen(file);
              }}
            >
              {asked
                ? t('menu.discard-and-open-file', { name: file.name })
                : file.name}
            </MenuItem>
            {asked && <MenuItem onChoose={cancel}>{t('menu.cancel')}</MenuItem>}
          </Fragment>
        );
      })}
      <DropdownMenu.Separator className={styles.rule} />
      <MenuItem onChoose={clear}>{t('menu.clear-recent-files')}</MenuItem>
    </Submenu>
  );
}
