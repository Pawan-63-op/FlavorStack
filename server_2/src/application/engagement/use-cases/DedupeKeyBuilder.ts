// Dedupe key for a dispatched notification (engagement_module.md §2): `sourceEventId:category`.
// One notification per (triggering event, category) — guarantees idempotent dispatch across
// at-least-once event redelivery, regardless of channel.
import { NotificationCategoryValue } from '../../../domain/engagement/enums/notification-category.enum';

export function buildDedupeKey(sourceEventId: string, category: NotificationCategoryValue): string {
  return `${sourceEventId}:${category}`;
}

// BullMQ forbids ':' in a custom job id (it delimits Redis keys — see FulfillmentNotificationDispatcher),
// so the queue job id uses the same value with ':' replaced by '-'. Same dedupe intent, legal id.
export function dedupeKeyToJobId(dedupeKey: string): string {
  return dedupeKey.replace(/:/g, '-');
}
