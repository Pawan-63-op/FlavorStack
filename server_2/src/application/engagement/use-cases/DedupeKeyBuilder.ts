import { NotificationCategoryValue } from '../../../domain/engagement/enums/notification-category.enum';

export function buildDedupeKey(sourceEventId: string, category: NotificationCategoryValue): string {
  return `${sourceEventId}:${category}`;
}

export function dedupeKeyToJobId(dedupeKey: string): string {
  return dedupeKey.replace(/:/g, '-');
}
