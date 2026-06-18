import { Notification } from '../../../../domain/engagement/entities/Notification';
import { NOTIFICATION_CATEGORY } from '../../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../../domain/engagement/enums/notification-channel.enum';
import { NOTIFICATION_STATUS } from '../../../../domain/engagement/enums/notification-status.enum';

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    recipientUserId: 'user-1',
    category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
    channel: NOTIFICATION_CHANNEL.PUSH,
    templateKey: 'order_confirmed',
    renderedTitle: 'Order confirmed',
    renderedBody: 'Your order has been confirmed',
    dedupeKey: 'event-1:ORDER_UPDATES',
    ...overrides,
  };
}

describe('Notification.queue', () => {
  it('creates a PENDING notification', () => {
    const result = Notification.queue(validInput());
    expect(result.isSuccess).toBe(true);
    const notification = result.getValue();
    expect(notification.status.value).toBe(NOTIFICATION_STATUS.PENDING);
    expect(notification.recipientUserId).toBe('user-1');
    expect(notification.dedupeKey).toBe('event-1:ORDER_UPDATES');
    expect(notification.sentAt).toBeUndefined();
    expect(notification.readAt).toBeUndefined();
  });

  it.each([
    ['empty recipientUserId', { recipientUserId: '' }],
    ['empty templateKey', { templateKey: '' }],
    ['empty dedupeKey', { dedupeKey: '' }],
  ])('rejects %s', (_label, overrides) => {
    expect(Notification.queue(validInput(overrides)).isFailure).toBe(true);
  });
});

describe('Notification lifecycle', () => {
  it('markSent moves PENDING -> SENT and records provider', () => {
    const notification = Notification.queue(validInput()).getValue();
    const result = notification.markSent('resend');
    expect(result.isSuccess).toBe(true);
    expect(notification.status.value).toBe(NOTIFICATION_STATUS.SENT);
    expect(notification.provider).toBe('resend');
    expect(notification.sentAt).toBeInstanceOf(Date);
  });

  it('markFailed moves PENDING -> FAILED and records reason', () => {
    const notification = Notification.queue(validInput()).getValue();
    const result = notification.markFailed('provider unreachable');
    expect(result.isSuccess).toBe(true);
    expect(notification.status.value).toBe(NOTIFICATION_STATUS.FAILED);
    expect(notification.failedReason).toBe('provider unreachable');
  });

  it('markRead moves SENT -> READ', () => {
    const notification = Notification.queue(validInput()).getValue();
    notification.markSent('resend');
    const result = notification.markRead();
    expect(result.isSuccess).toBe(true);
    expect(notification.status.value).toBe(NOTIFICATION_STATUS.READ);
    expect(notification.readAt).toBeInstanceOf(Date);
  });

  it('markRead fails when still PENDING', () => {
    const notification = Notification.queue(validInput()).getValue();
    expect(notification.markRead().isFailure).toBe(true);
  });

  it('markSent fails on an already-SENT notification', () => {
    const notification = Notification.queue(validInput()).getValue();
    notification.markSent('resend');
    expect(notification.markSent('resend').isFailure).toBe(true);
  });
});
