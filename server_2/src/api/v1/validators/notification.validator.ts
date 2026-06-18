import { z } from 'zod';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';

export const updatePreferencesSchema = z.object({
  changes: z
    .array(
      z.object({
        category: z.enum(Object.values(NOTIFICATION_CATEGORY) as [string, ...string[]]),
        channel: z.enum(Object.values(NOTIFICATION_CHANNEL) as [string, ...string[]]),
        enabled: z.boolean(),
      })
    )
    .min(1, 'At least one change is required'),
});

export const notificationHistoryQuery = z.object({
  limit: z.string().regex(/^\d+$/).optional(),
  offset: z.string().regex(/^\d+$/).optional(),
});

export const notificationIdParam = z.object({
  id: z.string().min(1, 'Notification id is required'),
});
