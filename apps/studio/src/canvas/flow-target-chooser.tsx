import { isEmptyName } from '@saerskriven/model';
import { Select } from 'radix-ui';
import { useTranslator } from '../messages/locale.js';
import { useModelStore } from '../store/store.js';
import {
  chooserOpened,
  commitFlowTarget,
  useConnecting,
} from './connecting.js';
import { flowEnds } from './elements.js';
import { currentLayout } from './layout.js';
import { CappedList } from '../ui/capped-list.js';
import cursor from '../ui/cursor-row.module.css';
import styles from './toolbox.module.css';

/** The flow target listbox under the chrome card, mounted only while a started flow waits for its target. */
export function FlowTargetChooser() {
  const layout = useModelStore(currentLayout);
  const connecting = useConnecting();
  const { t } = useTranslator();
  if (!connecting.open || connecting.from === undefined) {
    return null;
  }
  const targets = flowEnds(layout).filter(
    (node) => node.id !== connecting.from,
  );

  return (
    <Select.Root
      onOpenChange={chooserOpened}
      onValueChange={(value) => {
        const target = targets.find((node) => node.id === value)?.id;
        if (target !== undefined) {
          commitFlowTarget(target, connecting.from);
        }
      }}
      open
      value=""
    >
      <Select.Trigger
        aria-label={t('tools.flow-target')}
        className={styles.flowTrigger}
      >
        <Select.Value placeholder={t('tools.choose-flow-target')} />
      </Select.Trigger>
      <CappedList
        contentClassName={styles.content}
        viewportClassName={styles.viewport}
      >
        {targets.map((node) => (
          <Select.Item
            className={`${styles.item} ${cursor.row}`}
            key={node.id}
            value={node.id}
          >
            <Select.ItemText>{shownName(node.id, node.name)}</Select.ItemText>
          </Select.Item>
        ))}
      </CappedList>
    </Select.Root>
  );
}

function shownName(id: string, name: string): string {
  return isEmptyName(name) ? id : name;
}
