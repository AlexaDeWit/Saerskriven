import { ArrowRightIcon, Cross1Icon, WidthIcon } from '@radix-ui/react-icons';
import { Tooltip } from 'radix-ui';
import { useId, useRef, type ReactNode } from 'react';
import { closingOn } from '../commands/binding.js';
import {
  describeContextualShortcuts,
  type ContextualShortcutId,
} from '../commands/contextual-shortcuts.js';
import { hostPlatform } from '../commands/shortcuts.js';
import { useTranslator } from '../messages/locale.js';
import { useMeasured } from '../ui/measure.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import { PanelTabList, PanelTabs, type PanelTabsProps } from './panel-tabs.js';
import styles from './threat-panel.module.css';

type PanelFrameProps = {
  readonly label: string;
  readonly heading: string;
  readonly closeLabel: string;
  readonly closeShortcut: ContextualShortcutId;
  readonly testId?: string;
  readonly collapsed?: boolean;
  readonly onToggleCollapsed?: () => void;
  readonly wide: boolean;
  readonly onToggleWidth: () => void;
  readonly onClose: () => void;
  readonly onCover?: (cover: number) => void;
  readonly tabs?: PanelTabsProps;
  readonly children: ReactNode;
};

const widthLabel = (
  wide: boolean,
): 'panel.restore-pane-width' | 'panel.widen-pane' =>
  wide ? 'panel.restore-pane-width' : 'panel.widen-pane';

/** A scrolling pane with a collapsible drawer at phone widths. */
export function PanelFrame({
  label,
  heading,
  closeLabel,
  closeShortcut,
  testId,
  collapsed,
  onToggleCollapsed,
  wide,
  onToggleWidth,
  onClose,
  onCover,
  tabs,
  children,
}: PanelFrameProps) {
  const panel = useRef<HTMLElement>(null);
  const keyboardDescriptionId = useId();
  const bodyId = useId();
  const { t } = useTranslator();

  useMeasured(
    panel,
    (node, parent) => {
      onCover?.(
        (parent?.getBoundingClientRect().right ?? 0) -
          node.getBoundingClientRect().left,
      );
    },
    () => {
      onCover?.(0);
    },
    { alsoParent: true },
  );

  const frame = (
    <section
      aria-describedby={keyboardDescriptionId}
      aria-label={label}
      className={styles.panel}
      data-pane=""
      data-testid={testId}
      data-wide={wide}
      data-mobile-open={collapsed === undefined ? undefined : !collapsed}
      ref={panel}
      onKeyDownCapture={closingOn(closeShortcut, onClose)}
      onFocusCapture={(event) => {
        if (
          collapsed &&
          event.target.closest('[data-drawer-toggle]') === null
        ) {
          onToggleCollapsed?.();
        }
      }}
    >
      <VisuallyHidden id={keyboardDescriptionId}>
        {describeContextualShortcuts([closeShortcut], hostPlatform, t)}
      </VisuallyHidden>
      {collapsed !== undefined && (
        <button
          data-drawer-toggle
          aria-label={t(
            !collapsed ? 'panel.collapse-pane' : 'panel.expand-pane',
          )}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          className={styles.drawerToggle}
          onClick={onToggleCollapsed}
          type="button"
        >
          <ArrowRightIcon aria-hidden="true" />
          {collapsed && label}
        </button>
      )}
      <header className={styles.panelHeader}>
        <Tooltip.Provider>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                aria-label={t(widthLabel(wide))}
                aria-pressed={wide}
                className={styles.width}
                onClick={onToggleWidth}
                type="button"
              >
                {wide ? (
                  <ArrowRightIcon aria-hidden="true" />
                ) : (
                  <WidthIcon aria-hidden="true" />
                )}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content className={styles.tooltip} side="bottom">
              {t(widthLabel(wide))}
            </Tooltip.Content>
          </Tooltip.Root>
        </Tooltip.Provider>
        <h2 className={styles.heading}>{heading}</h2>
        <button
          aria-label={closeLabel}
          className={styles.close}
          onClick={onClose}
          type="button"
        >
          <Cross1Icon aria-hidden="true" />
        </button>
      </header>
      {tabs !== undefined && (
        <PanelTabList
          threatCount={tabs.threatCount}
          threatsTab={tabs.threatsTab}
        />
      )}
      <div className={styles.body} id={bodyId}>
        {children}
      </div>
    </section>
  );

  return tabs === undefined ? frame : <PanelTabs frame={frame} tabs={tabs} />;
}
