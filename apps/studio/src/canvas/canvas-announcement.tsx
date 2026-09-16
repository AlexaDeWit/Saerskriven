import { LiveRegion } from '../ui/live-region.js';
import { useAnnouncement } from './announcements.js';
import styles from './toolbox.module.css';

/** The canvas status region under the chrome card, saying what the last edit did. */
export function CanvasAnnouncement() {
  const announcement = useAnnouncement();

  return (
    <LiveRegion className={styles.announcement} testId="canvas-announcement">
      {announcement.message !== '' && (
        <p className={styles.message} key={announcement.sequence}>
          {announcement.message}
        </p>
      )}
    </LiveRegion>
  );
}
