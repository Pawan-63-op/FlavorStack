// Batch 4B — NotificationDispatcher orchestrates the send lifecycle for an enqueued engagement job:
// load the PENDING row → idempotency short-circuit if already SENT → select channel by
// notification.channel → send → markSent(provider)/markFailed(reason) + persist.
//
// Failure semantics (driven by NotificationStatus: PENDING → SENT | FAILED, FAILED terminal):
//   - channel returns Result.fail (e.g. no_recipient) → TERMINAL: markFailed + update, no throw.
//   - channel THROWS (transient provider error)       → propagate, row stays PENDING for BullMQ retry.
//   - markExhausted(): called by the worker after retries are exhausted → flips PENDING → FAILED.
import { NotificationDispatcher } from '../../../../infrastructure/notifications/NotificationDispatcher';
import { INotificationChannel } from '../../../../infrastructure/notifications/INotificationChannel';
import { INotificationRepository } from '../../../../domain/engagement/repositories/INotificationRepository';
import { Notification } from '../../../../domain/engagement/entities/Notification';
import { Result } from '../../../../domain/shared/Result';
import { NOTIFICATION_CHANNEL, NotificationChannelValue } from '../../../../domain/engagement/enums/notification-channel.enum';
import { NOTIFICATION_CATEGORY } from '../../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_STATUS } from '../../../../domain/engagement/enums/notification-status.enum';

function pendingNotification(channel: NotificationChannelValue = NOTIFICATION_CHANNEL.EMAIL): Notification {
  return Notification.queue({
    recipientUserId: 'user-1',
    category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
    channel,
    templateKey: 'order_confirmed',
    renderedTitle: 'Order confirmed',
    renderedBody: 'Your order is confirmed.',
    dedupeKey: 'evt-1:ORDER_UPDATES',
  }).getValue();
}

function makeRepo(notification: Notification | null): jest.Mocked<INotificationRepository> {
  return {
    save: jest.fn(async (_n: Notification) => {}),
    update: jest.fn(async (_n: Notification) => {}),
    findById: jest.fn(async (_id: string) => notification),
    findByDedupeKey: jest.fn(async (_dedupeKey: string) => null),
    findByRecipient: jest.fn(async (_userId: string) => []),
    countUnread: jest.fn(async (_userId: string) => 0),
  };
}

function makeChannel(channel: NotificationChannelValue, send: INotificationChannel['send']): INotificationChannel {
  return { channel, send: jest.fn(send) };
}

describe('NotificationDispatcher.dispatch', () => {
  it('sends via the matching channel, marks the row SENT with the provider, and persists', async () => {
    const notification = pendingNotification(NOTIFICATION_CHANNEL.EMAIL);
    const repo = makeRepo(notification);
    const email = makeChannel(NOTIFICATION_CHANNEL.EMAIL, async () => Result.ok({ provider: 'resend' }));
    const push = makeChannel(NOTIFICATION_CHANNEL.PUSH, async () => Result.ok({ provider: 'fcm' }));
    const dispatcher = new NotificationDispatcher(repo, [email, push]);

    const result = await dispatcher.dispatch('notif-1', NOTIFICATION_CHANNEL.EMAIL);

    expect(repo.findById).toHaveBeenCalledWith('notif-1');
    expect(email.send).toHaveBeenCalledWith(notification);
    expect(push.send).not.toHaveBeenCalled();
    expect(notification.status.value).toBe(NOTIFICATION_STATUS.SENT);
    expect(notification.provider).toBe('resend');
    expect(repo.update).toHaveBeenCalledWith(notification);
    expect(result.outcome).toBe('SENT');
  });

  it('is idempotent: an already-SENT row is skipped — no channel send, no second persist', async () => {
    const notification = pendingNotification(NOTIFICATION_CHANNEL.EMAIL);
    notification.markSent('resend');
    const repo = makeRepo(notification);
    const email = makeChannel(NOTIFICATION_CHANNEL.EMAIL, async () => Result.ok({ provider: 'resend' }));
    const dispatcher = new NotificationDispatcher(repo, [email]);

    const result = await dispatcher.dispatch('notif-1', NOTIFICATION_CHANNEL.EMAIL);

    expect(email.send).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
    expect(result.outcome).toBe('SKIPPED');
  });

  it('marks the row FAILED (terminal) when the channel returns a no_recipient failure — does not throw', async () => {
    const notification = pendingNotification(NOTIFICATION_CHANNEL.EMAIL);
    const repo = makeRepo(notification);
    const email = makeChannel(NOTIFICATION_CHANNEL.EMAIL, async () => Result.fail('no_recipient'));
    const dispatcher = new NotificationDispatcher(repo, [email]);

    const result = await dispatcher.dispatch('notif-1', NOTIFICATION_CHANNEL.EMAIL);

    expect(notification.status.value).toBe(NOTIFICATION_STATUS.FAILED);
    expect(notification.failedReason).toBe('no_recipient');
    expect(repo.update).toHaveBeenCalledWith(notification);
    expect(result.outcome).toBe('FAILED');
    expect(result.reason).toBe('no_recipient');
  });

  it('propagates transient provider errors and leaves the row PENDING for retry', async () => {
    const notification = pendingNotification(NOTIFICATION_CHANNEL.PUSH);
    const repo = makeRepo(notification);
    const push = makeChannel(NOTIFICATION_CHANNEL.PUSH, async () => {
      throw new Error('fcm 503');
    });
    const dispatcher = new NotificationDispatcher(repo, [push]);

    await expect(dispatcher.dispatch('notif-1', NOTIFICATION_CHANNEL.PUSH)).rejects.toThrow('fcm 503');
    expect(notification.status.value).toBe(NOTIFICATION_STATUS.PENDING);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('skips when the notification row no longer exists', async () => {
    const repo = makeRepo(null);
    const email = makeChannel(NOTIFICATION_CHANNEL.EMAIL, async () => Result.ok({ provider: 'resend' }));
    const dispatcher = new NotificationDispatcher(repo, [email]);

    const result = await dispatcher.dispatch('missing', NOTIFICATION_CHANNEL.EMAIL);

    expect(email.send).not.toHaveBeenCalled();
    expect(result.outcome).toBe('SKIPPED');
  });
});

describe('NotificationDispatcher.markExhausted', () => {
  it('flips a still-PENDING row to FAILED with the given reason', async () => {
    const notification = pendingNotification(NOTIFICATION_CHANNEL.EMAIL);
    const repo = makeRepo(notification);
    const dispatcher = new NotificationDispatcher(repo, []);

    await dispatcher.markExhausted('notif-1', 'retries exhausted');

    expect(notification.status.value).toBe(NOTIFICATION_STATUS.FAILED);
    expect(notification.failedReason).toBe('retries exhausted');
    expect(repo.update).toHaveBeenCalledWith(notification);
  });

  it('is a no-op when the row already left PENDING (e.g. a later attempt actually SENT it)', async () => {
    const notification = pendingNotification(NOTIFICATION_CHANNEL.EMAIL);
    notification.markSent('resend');
    const repo = makeRepo(notification);
    const dispatcher = new NotificationDispatcher(repo, []);

    await dispatcher.markExhausted('notif-1', 'retries exhausted');

    expect(notification.status.value).toBe(NOTIFICATION_STATUS.SENT);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
