import { NotificationMapper } from '../../../../../infrastructure/database/mappers/NotificationMapper';
import { ReviewMapper } from '../../../../../infrastructure/database/mappers/ReviewMapper';
import { NotificationPreferenceMapper } from '../../../../../infrastructure/database/mappers/NotificationPreferenceMapper';
import { NotificationTemplateMapper } from '../../../../../infrastructure/database/mappers/NotificationTemplateMapper';
import { Notification } from '../../../../../domain/engagement/entities/Notification';
import { Review } from '../../../../../domain/engagement/entities/Review';
import { NotificationPreference } from '../../../../../domain/engagement/entities/NotificationPreference';
import { NotificationTemplate } from '../../../../../domain/engagement/entities/NotificationTemplate';
import { NOTIFICATION_CATEGORY } from '../../../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../../../domain/engagement/enums/notification-channel.enum';
import { DomainError } from '../../../../../domain/shared/errors/DomainError';

describe('NotificationMapper', () => {
  function queued(): Notification {
    return Notification.queue({
      recipientUserId: 'user-1',
      category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
      channel: NOTIFICATION_CHANNEL.EMAIL,
      templateKey: 'order_confirmed',
      renderedTitle: 'Order confirmed',
      renderedBody: 'Hi Pat',
      dedupeKey: 'evt-1:ORDER_UPDATES',
    }).getValue();
  }

  it('round-trips a PENDING notification through persistence', () => {
    const original = queued();
    const back = NotificationMapper.toDomain(NotificationMapper.toPersistence(original));

    expect(back.id.toString()).toBe(original.id.toString());
    expect(back.recipientUserId).toBe('user-1');
    expect(back.category).toBe(NOTIFICATION_CATEGORY.ORDER_UPDATES);
    expect(back.channel).toBe(NOTIFICATION_CHANNEL.EMAIL);
    expect(back.templateKey).toBe('order_confirmed');
    expect(back.renderedTitle).toBe('Order confirmed');
    expect(back.renderedBody).toBe('Hi Pat');
    expect(back.dedupeKey).toBe('evt-1:ORDER_UPDATES');
    expect(back.status.value).toBe('PENDING');
    expect(back.createdAt.getTime()).toBe(original.createdAt.getTime());
    expect(back.provider).toBeUndefined();
    expect(back.sentAt).toBeUndefined();
  });

  it('preserves provider + sentAt for a SENT notification', () => {
    const note = queued();
    note.markSent('resend');
    const back = NotificationMapper.toDomain(NotificationMapper.toPersistence(note));

    expect(back.status.value).toBe('SENT');
    expect(back.provider).toBe('resend');
    expect(back.sentAt).toBeInstanceOf(Date);
  });

  it('throws a DomainError when the persisted status is corrupt', () => {
    const doc = NotificationMapper.toPersistence(queued());
    expect(() => NotificationMapper.toDomain({ ...doc, status: 'BOGUS' as never })).toThrow(DomainError);
  });
});

describe('ReviewMapper', () => {
  function submit(overrides: Partial<{ deliveryRating: number | null; comment: string | null }> = {}): Review {
    return Review.submit({
      customerId: 'cust-1',
      restaurantId: 'rest-1',
      fulfillmentId: 'ful-1',
      restaurantRating: 5,
      deliveryRating: overrides.deliveryRating === undefined ? 4 : overrides.deliveryRating,
      comment: overrides.comment === undefined ? 'Great food' : overrides.comment,
    }).getValue();
  }

  it('round-trips a moderated review with delivery rating + comment', () => {
    const review = submit();
    review.approve('mod-1');
    const back = ReviewMapper.toDomain(ReviewMapper.toPersistence(review));

    expect(back.id.toString()).toBe(review.id.toString());
    expect(back.customerId).toBe('cust-1');
    expect(back.restaurantRating.value).toBe(5);
    expect(back.deliveryRating?.value).toBe(4);
    expect(back.comment?.value).toBe('Great food');
    expect(back.moderationStatus.value).toBe('APPROVED');
    expect(back.moderatedBy).toBe('mod-1');
    expect(back.moderatedAt).toBeInstanceOf(Date);
  });

  it('round-trips a review with no delivery rating and no comment (null branches)', () => {
    const review = submit({ deliveryRating: null, comment: null });
    const back = ReviewMapper.toDomain(ReviewMapper.toPersistence(review));

    expect(back.deliveryRating).toBeNull();
    expect(back.comment).toBeNull();
    expect(back.moderationStatus.value).toBe('PENDING');
    expect(back.moderatedAt).toBeUndefined();
    expect(back.moderatedBy).toBeUndefined();
  });

  it('throws a DomainError when a persisted rating is out of range', () => {
    const doc = ReviewMapper.toPersistence(submit());
    expect(() => ReviewMapper.toDomain({ ...doc, restaurantRating: 9 })).toThrow(DomainError);
  });
});

describe('NotificationPreferenceMapper', () => {
  it('round-trips default preferences (PROMOTIONS push-only) preserving every toggle', () => {
    const pref = NotificationPreference.createDefault('user-7');
    const back = NotificationPreferenceMapper.toDomain(NotificationPreferenceMapper.toPersistence(pref));

    expect(back.id.toString()).toBe(pref.id.toString());
    expect(back.userId).toBe('user-7');
    expect(back.updatedAt.getTime()).toBe(pref.updatedAt.getTime());
    expect(back.isEnabled(NOTIFICATION_CATEGORY.ORDER_UPDATES, NOTIFICATION_CHANNEL.EMAIL)).toBe(true);
    expect(back.isEnabled(NOTIFICATION_CATEGORY.PROMOTIONS, NOTIFICATION_CHANNEL.INBOX)).toBe(true);
    expect(back.isEnabled(NOTIFICATION_CATEGORY.PROMOTIONS, NOTIFICATION_CHANNEL.EMAIL)).toBe(false);
  });

  it('round-trips a customised toggle', () => {
    const pref = NotificationPreference.createDefault('user-8');
    pref.setChannel(NOTIFICATION_CATEGORY.ORDER_UPDATES, NOTIFICATION_CHANNEL.EMAIL, false);
    const back = NotificationPreferenceMapper.toDomain(NotificationPreferenceMapper.toPersistence(pref));

    expect(back.isEnabled(NOTIFICATION_CATEGORY.ORDER_UPDATES, NOTIFICATION_CHANNEL.EMAIL)).toBe(false);
    expect(back.isEnabled(NOTIFICATION_CATEGORY.ORDER_UPDATES, NOTIFICATION_CHANNEL.INBOX)).toBe(true);
  });
});

describe('NotificationTemplateMapper', () => {
  it('round-trips a template and the rehydrated copy still renders', () => {
    const template = NotificationTemplate.create({
      key: 'order_confirmed',
      channel: NOTIFICATION_CHANNEL.INBOX,
      locale: 'en',
      titleTemplate: 'Order {{orderId}}',
      bodyTemplate: 'Hi {{name}}',
    }).getValue();
    const back = NotificationTemplateMapper.toDomain(NotificationTemplateMapper.toPersistence(template));

    expect(back.id.toString()).toBe(template.id.toString());
    expect(back.key).toBe('order_confirmed');
    expect(back.channel).toBe(NOTIFICATION_CHANNEL.INBOX);
    expect(back.locale).toBe('en');
    expect(back.titleTemplate).toBe('Order {{orderId}}');
    expect(back.bodyTemplate).toBe('Hi {{name}}');
    expect(back.active).toBe(true);
    expect(back.render({ orderId: '42', name: 'Asha' })).toEqual({ title: 'Order 42', body: 'Hi Asha' });
  });

  it('preserves a deactivated flag through persistence', () => {
    const template = NotificationTemplate.create({
      key: 'welcome',
      channel: NOTIFICATION_CHANNEL.EMAIL,
      locale: 'en',
      titleTemplate: 'Welcome',
      bodyTemplate: 'Hello',
    }).getValue();
    template.deactivate();
    const back = NotificationTemplateMapper.toDomain(NotificationTemplateMapper.toPersistence(template));

    expect(back.active).toBe(false);
  });
});
