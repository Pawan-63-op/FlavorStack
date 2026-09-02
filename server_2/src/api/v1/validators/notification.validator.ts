import { z } from 'zod';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';

/**
 * Frozen-contract alias (Phase 5 Batch 2). Internally the channel is `INBOX`; the wire contract
 * still says `PUSH`, because `my-app` persists and renders a binary `{push, email}` shape. The
 * accepted values are deliberately a literal, NOT derived from `NOTIFICATION_CHANNEL` — the enum
 * has moved on and the wire must not follow it. Paired with the outbound alias in
 * `application/engagement/responses/NotificationPreferenceResponse.ts`.
 */
const WIRE_CHANNELS = ['PUSH', 'EMAIL'] as const;

export const updatePreferencesSchema = z.object({
  changes: z
    .array(
      z.object({
        category: z.enum(Object.values(NOTIFICATION_CATEGORY) as [string, ...string[]]),
        channel: z
          .enum(WIRE_CHANNELS)
          .transform((c) => (c === 'PUSH' ? NOTIFICATION_CHANNEL.INBOX : NOTIFICATION_CHANNEL.EMAIL)),
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
