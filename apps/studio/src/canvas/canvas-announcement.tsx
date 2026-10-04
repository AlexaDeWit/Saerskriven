import { LiveRegion } from '../ui/live-region.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import { useAnnouncement } from './announcements.js';

/** Announces canvas activity without covering the drawing. */
export function CanvasAnnouncement() {
  const announcement = useAnnouncement();
  return (
    <LiveRegion testId="canvas-announcement">
      {announcement.message !== '' && (
        <VisuallyHidden key={announcement.sequence}>
          {announcement.message}
        </VisuallyHidden>
      )}
    </LiveRegion>
  );
}
