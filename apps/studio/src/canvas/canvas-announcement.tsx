import { LiveRegion } from '../ui/live-region.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import { useAnnouncement } from './announcements.js';
import styles from './toolbox.module.css';

/**
 * The canvas status region under the chrome card, saying what the last edit
 * did. An undrawn announcement is held as hidden text, so the region says it
 * and draws no line.
 */
export function CanvasAnnouncement() {
  const announcement = useAnnouncement();

  return (
    <LiveRegion className={styles.announcement} testId="canvas-announcement">
      {announcement.message !== '' &&
        (announcement.drawn ? (
          <p className={styles.message} key={announcement.sequence}>
            {announcement.message}
          </p>
        ) : (
          <VisuallyHidden key={announcement.sequence}>
            {announcement.message}
          </VisuallyHidden>
        ))}
    </LiveRegion>
  );
}
