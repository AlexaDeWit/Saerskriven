import { Tabs } from 'radix-ui';
import type { ReactElement, ReactNode, Ref } from 'react';
import { useTranslator } from '../messages/locale.js';
import styles from './threat-panel.module.css';

const panelTabs = ['threats', 'details'] as const;

/** Which of a panel's two tabs shows: the subject's threats or its own fields. */
export type PanelTab = (typeof panelTabs)[number];

/** The tab shown, the call that shows another, the count the Threats tab carries, and a ref to that tab. */
export type PanelTabsProps = {
  readonly tab: PanelTab;
  readonly onTab: (tab: PanelTab) => void;
  readonly threatCount: number;
  readonly threatsTab?: Ref<HTMLButtonElement>;
};

/**
 * Makes `frame`, the pane's own element, the root of its tabs, so the tab
 * list can sit under the heading outside the body that scrolls.
 */
export function PanelTabs({
  tabs,
  frame,
}: {
  readonly tabs: PanelTabsProps;
  readonly frame: ReactElement;
}) {
  return (
    <Tabs.Root
      asChild
      onValueChange={(value) => {
        tabs.onTab(panelTabs.find((known) => known === value) ?? 'threats');
      }}
      value={tabs.tab}
    >
      {frame}
    </Tabs.Root>
  );
}

/** The Threats tab, carrying its count, and the Details tab. */
export function PanelTabList({
  threatCount,
  threatsTab,
}: Pick<PanelTabsProps, 'threatCount' | 'threatsTab'>) {
  const { t } = useTranslator();

  return (
    <Tabs.List className={styles.tabList}>
      <Tabs.Trigger className={styles.tab} ref={threatsTab} value="threats">
        {t('panel.threats')} <span className={styles.count}>{threatCount}</span>
      </Tabs.Trigger>
      <Tabs.Trigger className={styles.tab} value="details">
        {t('panel.details')}
      </Tabs.Trigger>
    </Tabs.List>
  );
}

/**
 * One tab's content. Both stay mounted while the other shows, so a draft,
 * an open threat or an open record survives a visit to the other tab. The
 * content takes no Tab stop of its own, since each opens on a control.
 */
export function PanelTabContent({
  value,
  tab,
  children,
}: {
  readonly value: PanelTab;
  readonly tab: PanelTab;
  readonly children: ReactNode;
}) {
  return (
    <Tabs.Content
      className={styles.tabContent}
      forceMount
      hidden={value !== tab}
      tabIndex={-1}
      value={value}
    >
      {children}
    </Tabs.Content>
  );
}
