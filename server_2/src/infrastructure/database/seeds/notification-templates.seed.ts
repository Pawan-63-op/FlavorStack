import { NotificationTemplate } from '../../../domain/engagement/entities/NotificationTemplate';
import {
  NOTIFICATION_CHANNEL,
  NotificationChannelValue,
} from '../../../domain/engagement/enums/notification-channel.enum';
import { INotificationTemplateRepository } from '../../../domain/engagement/repositories/INotificationTemplateRepository';
import { logger } from '../../observability/logger';

const DEFAULT_LOCALE = 'en';

interface TemplateSeed {
  key: string;
  channel: NotificationChannelValue;
  titleTemplate: string;
  bodyTemplate: string;
}

/** The seeded template set: the eight §2 keys + password_reset, on their dispatch channel. */
export const NOTIFICATION_TEMPLATE_SEEDS: readonly TemplateSeed[] = [
  {
    key: 'welcome',
    channel: NOTIFICATION_CHANNEL.EMAIL,
    titleTemplate: 'Welcome to FlavorStack, {{name}}!',
    bodyTemplate: 'Hi {{name}}, thanks for joining FlavorStack. Your account is ready.',
  },
  {
    key: 'password_changed',
    channel: NOTIFICATION_CHANNEL.EMAIL,
    titleTemplate: 'Your password was changed',
    bodyTemplate: 'Your FlavorStack password was changed at {{changedAt}}. If this was not you, contact support.',
  },
  {
    key: 'password_reset',
    channel: NOTIFICATION_CHANNEL.EMAIL,
    titleTemplate: 'Reset your password',
    bodyTemplate: 'We received a password reset request for {{email}}. Follow the link in this email to reset it.',
  },
  {
    key: 'order_confirmed',
    channel: NOTIFICATION_CHANNEL.PUSH,
    titleTemplate: 'Order confirmed',
    bodyTemplate: 'Your order {{fulfillmentId}} has been confirmed and is being prepared.',
  },
  {
    key: 'ready_for_pickup',
    channel: NOTIFICATION_CHANNEL.PUSH,
    titleTemplate: 'Ready for pickup',
    bodyTemplate: 'Order {{fulfillmentId}} is ready and waiting for a rider.',
  },
  {
    key: 'order_cancelled',
    channel: NOTIFICATION_CHANNEL.PUSH,
    titleTemplate: 'Order cancelled',
    bodyTemplate: 'Order {{fulfillmentId}} was cancelled. {{reason}}',
  },
  {
    key: 'rider_assigned',
    channel: NOTIFICATION_CHANNEL.PUSH,
    titleTemplate: 'A rider is on the way',
    bodyTemplate: 'A rider has been assigned to your order {{fulfillmentId}}.',
  },
  {
    key: 'out_for_delivery',
    channel: NOTIFICATION_CHANNEL.PUSH,
    titleTemplate: 'Out for delivery',
    bodyTemplate: 'Your order {{fulfillmentId}} is out for delivery.',
  },
  {
    key: 'delivered',
    channel: NOTIFICATION_CHANNEL.PUSH,
    titleTemplate: 'Delivered — enjoy!',
    bodyTemplate: 'Your order {{fulfillmentId}} has been delivered. Tap to rate your experience.',
  },
];

/**
 * Idempotently seed the notification templates. For each entry, insert-if-absent keyed by
 * (key, channel, locale=en). Returns the count of templates newly created (existing ones are
 * left untouched). Safe to call on every boot.
 */
export async function seedNotificationTemplates(
  repo: INotificationTemplateRepository,
  locale: string = DEFAULT_LOCALE
): Promise<number> {
  let created = 0;

  for (const seed of NOTIFICATION_TEMPLATE_SEEDS) {
    const existing = await repo.findByKeyChannelLocale(seed.key, seed.channel, locale);
    if (existing) continue;

    const result = NotificationTemplate.create({
      key: seed.key,
      channel: seed.channel,
      locale,
      titleTemplate: seed.titleTemplate,
      bodyTemplate: seed.bodyTemplate,
    });
    if (result.isFailure) {
      throw new Error(`Invalid notification template seed "${seed.key}": ${String(result.getError())}`);
    }

    await repo.save(result.getValue());
    created += 1;
  }

  if (created > 0) {
    logger.info({ created, total: NOTIFICATION_TEMPLATE_SEEDS.length }, '[seed] notification templates seeded');
  }
  return created;
}
