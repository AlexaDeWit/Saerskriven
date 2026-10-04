import { Cross1Icon } from '@radix-ui/react-icons';
import type { CanvasEdge } from '@saerskriven/canvas';
import { Panel, useViewport } from '@xyflow/react';
import { useId, useState, type RefObject } from 'react';
import { IconCommandButton } from '../commands/command-button.js';
import { useTranslator } from '../messages/locale.js';
import { useMeasured } from '../ui/measure.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import { FlowEndpointCommands } from './selection-controls.js';
import { strokeGlyph } from './stroke-glyph.js';
import styles from './handles.module.css';
import toolbox from './toolbox.module.css';

/** A single route toolbar beside the flow, bounded by the viewport and pane. */
export function FlowRouteToolbar({
  edge,
  panelCover,
  toolbar,
  help,
  placing,
  cancel,
}: {
  readonly edge: CanvasEdge;
  readonly panelCover: number;
  readonly toolbar: RefObject<HTMLFieldSetElement | null>;
  readonly help: string;
  readonly placing: boolean;
  readonly cancel: () => void;
}) {
  const { x, y, zoom } = useViewport();
  const { t } = useTranslator();
  const description = useId();
  const [size, setSize] = useState({ width: 0, height: 0 });
  useMeasured(
    toolbar,
    (node) => {
      const { width, height } = node.getBoundingClientRect();
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    },
    () => {},
  );
  const centre = {
    x: x + ((edge.source.x + edge.target.x) / 2) * zoom,
    y: y + ((edge.source.y + edge.target.y) / 2) * zoom,
  };
  return (
    <Panel
      position="top-left"
      className={styles.routePanel}
      style={{ right: panelCover }}
    >
      <fieldset
        aria-label={t('tools.flow-route')}
        aria-describedby={description}
        className={`${styles.toolbar} ${styles.routeToolbar} nodrag nopan`}
        data-bend-toolbar
        ref={toolbar}
        tabIndex={-1}
        style={{
          left: `clamp(8px, ${String(centre.x - size.width / 2)}px, calc(100% - ${String(size.width + 8)}px))`,
          top: `clamp(var(--saer-pane-block-start), ${String(centre.y + 28)}px, calc(100% - ${String(size.height + 64)}px))`,
        }}
      >
        <IconCommandButton
          className={toolbox.control}
          command="add-bend"
          description={help}
        >
          {strokeGlyph(<path d="M2 12 8 4l6 8M8 1v6M5 4h6" />)}
        </IconCommandButton>
        <FlowEndpointCommands inline />
        <VisuallyHidden id={description}>{help}</VisuallyHidden>
        {placing && (
          <button
            aria-label={t('tools.cancel')}
            title={t('tools.cancel')}
            className={toolbox.control}
            onClick={cancel}
            type="button"
          >
            <Cross1Icon aria-hidden="true" />
          </button>
        )}
      </fieldset>
    </Panel>
  );
}
