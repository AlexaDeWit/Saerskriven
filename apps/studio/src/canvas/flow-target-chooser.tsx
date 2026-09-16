import { Select } from 'radix-ui';
import { useModelStore } from '../store/store.js';
import {
  chooserOpened,
  commitFlowTarget,
  useConnecting,
} from './connecting.js';
import { flowEnds } from './elements.js';
import { currentLayout } from './layout.js';
import styles from './toolbox.module.css';

/** The flow target listbox under the chrome card, mounted only while a started flow waits for its target. */
export function FlowTargetChooser() {
  const layout = useModelStore(currentLayout);
  const connecting = useConnecting();
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
      <Select.Trigger aria-label="Flow target" className={styles.flowTrigger}>
        <Select.Value placeholder="Choose a flow target" />
      </Select.Trigger>
      <Select.Content className={styles.content} position="popper">
        <Select.Viewport className={styles.viewport}>
          {targets.map((node) => (
            <Select.Item className={styles.item} key={node.id} value={node.id}>
              <Select.ItemText>{shownName(node.id, node.name)}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Viewport>
      </Select.Content>
    </Select.Root>
  );
}

function shownName(id: string, name: string): string {
  return name === '' ? id : name;
}
