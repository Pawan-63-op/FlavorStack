import { MarkNotificationRead } from '../../../../application/engagement/use-cases/MarkNotificationRead';
import { GetNotificationHistory } from '../../../../application/engagement/use-cases/GetNotificationHistory';
import { GetUnreadCount } from '../../../../application/engagement/use-cases/GetUnreadCount';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { Notification } from '../../../../domain/engagement/entities/Notification';
import { NOTIFICATION_CATEGORY } from '../../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../../domain/engagement/enums/notification-channel.enum';
import { makeNotificationRepo } from './_helpers';

function sentNotification(recipientUserId = 'user-1'): Notification {
  const n = Notification.queue({
    recipientUserId,
    category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
    channel: NOTIFICATION_CHANNEL.EMAIL,
    templateKey: 'order_confirmed',
    renderedTitle: 'Confirmed',
    renderedBody: 'Your order is confirmed',
    dedupeKey: 'evt-1:ORDER_UPDATES',
  }).getValue();
  n.markSent('resend');
  return n;
}

describe('MarkNotificationRead', () => {
  it('marks a sent notification as read and persists', async () => {
    const n = sentNotification();
    const repo = makeNotificationRepo({ findById: jest.fn().mockResolvedValue(n) });
    const uc = new MarkNotificationRead(repo);

    const result = await uc.execute({ userId: 'user-1', notificationId: n.id.toString() });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().status).toBe('READ');
    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  it('returns NotFoundError when the notification does not exist', async () => {
    const repo = makeNotificationRepo({ findById: jest.fn().mockResolvedValue(null) });
    const uc = new MarkNotificationRead(repo);
    const result = await uc.execute({ userId: 'user-1', notificationId: 'missing' });
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(NotFoundError);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('returns ForbiddenError when the notification belongs to another user', async () => {
    const n = sentNotification('owner');
    const repo = makeNotificationRepo({ findById: jest.fn().mockResolvedValue(n) });
    const uc = new MarkNotificationRead(repo);
    const result = await uc.execute({ userId: 'intruder', notificationId: n.id.toString() });
    expect(result.isFailure).toBe(true);
    expect(result.getError()).toBeInstanceOf(ForbiddenError);
    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe('GetNotificationHistory', () => {
  it('returns the recipient history, paginated', async () => {
    const repo = makeNotificationRepo({ findByRecipient: jest.fn().mockResolvedValue([sentNotification()]) });
    const uc = new GetNotificationHistory(repo);

    const result = await uc.execute({ userId: 'user-1', limit: 10, offset: 20 });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toHaveLength(1);
    expect(repo.findByRecipient).toHaveBeenCalledWith('user-1', { limit: 10, offset: 20 });
  });
});

describe('GetUnreadCount', () => {
  it('returns the unread count for the user', async () => {
    const repo = makeNotificationRepo({ countUnread: jest.fn().mockResolvedValue(7) });
    const uc = new GetUnreadCount(repo);

    const result = await uc.execute({ userId: 'user-1' });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().count).toBe(7);
    expect(repo.countUnread).toHaveBeenCalledWith('user-1');
  });
});
