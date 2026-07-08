import { randomUUID } from 'crypto';
import { Notification } from '../../../domain/engagement/entities/Notification';
import { Result } from '../../../domain/shared/Result';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL, NotificationChannelValue } from '../../../domain/engagement/enums/notification-channel.enum';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoNotificationRepository } from '../../../infrastructure/repositories/NotificationRepository';
import { NotificationModel } from '../../../infrastructure/database/models/NotificationModel';
import { NotificationDispatcher } from '../../../infrastructure/notifications/NotificationDispatcher';
import { ChannelSendResult, INotificationChannel } from '../../../infrastructure/notifications/INotificationChannel';

function buildNotification(channel: NotificationChannelValue): Notification {
  return Notification.queue({
    recipientUserId: 'user-1',
    category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
    channel,
    templateKey: 'order_confirmed',
    renderedTitle: 'Order confirmed',
    renderedBody: 'Your order is confirmed',
    dedupeKey: `evt-${randomUUID()}:ORDER_UPDATES`,
  }).getValue();
}

function stubChannel(
  channel: NotificationChannelValue,
  send: (n: Notification) => Promise<Result<ChannelSendResult>>,
): INotificationChannel & { sendCount: number } {
  let sendCount = 0;
  return {
    channel,
    sendCount,
    async send(n: Notification) {
      this.sendCount += 1;
      return send(n);
    },
  };
}

describe('NotificationDispatcher (integration)', () => {
  let txContext: TransactionContext;
  let repo: MongoNotificationRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoNotificationRepository(txContext);
  });

  afterEach(async () => {
    await NotificationModel.deleteMany({});
  });

  it('dispatches a PENDING notification and persists it as SENT with the channel provider', async () => {
    const n = buildNotification(NOTIFICATION_CHANNEL.EMAIL);
    await repo.save(n);
    const email = stubChannel(NOTIFICATION_CHANNEL.EMAIL, async () => Result.ok({ provider: 'resend' }));
    const dispatcher = new NotificationDispatcher(repo, [email]);

    const result = await dispatcher.dispatch(n.id.toString(), NOTIFICATION_CHANNEL.EMAIL);

    expect(result.outcome).toBe('SENT');
    const persisted = await repo.findById(n.id.toString());
    expect(persisted!.status.value).toBe('SENT');
    expect(persisted!.provider).toBe('resend');
    expect(persisted!.sentAt).toBeInstanceOf(Date);
  });

  it('persists FAILED (terminal) when the channel reports no_recipient — without throwing', async () => {
    const n = buildNotification(NOTIFICATION_CHANNEL.EMAIL);
    await repo.save(n);
    const email = stubChannel(NOTIFICATION_CHANNEL.EMAIL, async () => Result.fail('no_recipient'));
    const dispatcher = new NotificationDispatcher(repo, [email]);

    const result = await dispatcher.dispatch(n.id.toString(), NOTIFICATION_CHANNEL.EMAIL);

    expect(result.outcome).toBe('FAILED');
    const persisted = await repo.findById(n.id.toString());
    expect(persisted!.status.value).toBe('FAILED');
    expect(persisted!.failedReason).toBe('no_recipient');
  });

  it('leaves the row PENDING when the channel throws transiently (so BullMQ can retry)', async () => {
    const n = buildNotification(NOTIFICATION_CHANNEL.PUSH);
    await repo.save(n);
    const push = stubChannel(NOTIFICATION_CHANNEL.PUSH, async () => {
      throw new Error('fcm 503');
    });
    const dispatcher = new NotificationDispatcher(repo, [push]);

    await expect(dispatcher.dispatch(n.id.toString(), NOTIFICATION_CHANNEL.PUSH)).rejects.toThrow('fcm 503');
    const persisted = await repo.findById(n.id.toString());
    expect(persisted!.status.value).toBe('PENDING');
  });

  it('markExhausted settles a still-PENDING row as FAILED after retries are spent', async () => {
    const n = buildNotification(NOTIFICATION_CHANNEL.PUSH);
    await repo.save(n);
    const dispatcher = new NotificationDispatcher(repo, []);

    await dispatcher.markExhausted(n.id.toString(), 'retries exhausted');

    const persisted = await repo.findById(n.id.toString());
    expect(persisted!.status.value).toBe('FAILED');
    expect(persisted!.failedReason).toBe('retries exhausted');
  });

  it('does not double-send: re-dispatching an already-SENT row is skipped (idempotency)', async () => {
    const n = buildNotification(NOTIFICATION_CHANNEL.EMAIL);
    await repo.save(n);
    const email = stubChannel(NOTIFICATION_CHANNEL.EMAIL, async () => Result.ok({ provider: 'resend' }));
    const dispatcher = new NotificationDispatcher(repo, [email]);

    const first = await dispatcher.dispatch(n.id.toString(), NOTIFICATION_CHANNEL.EMAIL);
    const second = await dispatcher.dispatch(n.id.toString(), NOTIFICATION_CHANNEL.EMAIL);

    expect(first.outcome).toBe('SENT');
    expect(second.outcome).toBe('SKIPPED');
    expect(email.sendCount).toBe(1);
  });
});
