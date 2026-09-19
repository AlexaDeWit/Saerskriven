import {
  EnterFullScreenIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@radix-ui/react-icons';
import { Panel, useViewport } from '@xyflow/react';
import { IconCommandButton } from '../commands/command-button.js';
import { useTranslator } from '../messages/locale.js';
import styles from './zoom-cluster.module.css';

/** The zoom and fit controls over the canvas. */
export function ZoomCluster() {
  const { zoom } = useViewport();
  const { t, locale } = useTranslator();
  const percent = Math.round(zoom * 100);
  const shown = new Intl.NumberFormat(locale, { style: 'percent' }).format(
    percent / 100,
  );
  return (
    <Panel position="bottom-right" className={styles.panel}>
      <section aria-label={t('tools.zoom-and-fit')} className={styles.cluster}>
        <IconCommandButton className={styles.control} command="zoom-in">
          <ZoomInIcon aria-hidden="true" className={styles.glyph} />
        </IconCommandButton>
        <IconCommandButton className={styles.control} command="zoom-out">
          <ZoomOutIcon aria-hidden="true" className={styles.glyph} />
        </IconCommandButton>
        <IconCommandButton
          className={styles.percentage}
          command="reset-zoom"
          description={t('tools.current-zoom', { percent })}
        >
          <span>{shown}</span>
        </IconCommandButton>
        <IconCommandButton className={styles.control} command="fit-selection">
          <span aria-hidden="true">⊡</span>
        </IconCommandButton>
        <IconCommandButton className={styles.control} command="fit-to-view">
          <EnterFullScreenIcon aria-hidden="true" className={styles.glyph} />
        </IconCommandButton>
      </section>
    </Panel>
  );
}
