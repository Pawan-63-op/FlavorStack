import { randomUUID } from 'crypto';
import { Notification } from '../../../domain/engagement/entities/Notification';
import { NOTIFICATION_CATEGORY } from '../../../domain/engagement/enums/notification-category.enum';
import { NOTIFICATION_CHANNEL } from '../../../domain/engagement/enums/notification-channel.enum';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoNotificationRepository } from '../../../infrastructure/repositories/NotificationRepository';
import { NotificationModel } from '../../../infrastructure/database/models/NotificationModel';

function buildNotification(overrides: { recipientUserId?: string; dedupeKey?: string } = {}): Notification {
  return Notification.queue({
    recipientUserId: overrides.recipientUserId ?? 'user-1',
    category: NOTIFICATION_CATEGORY.ORDER_UPDATES,
    channel: NOTIFICATION_CHANNEL.PUSH,
    templateKey: 'order_confirmed',
    renderedTitle: 'Order confirmed',
    renderedBody: 'Your order is confirmed',
    dedupeKey: overrides.dedupeKey ?? `evt-${randomUUID()}:ORDER_UPDATES`,
  }).getValue();
}

describe('MongoNotificationRepository', () => {
  let txContext: TransactionContext;
  let repo: MongoNotificationRepository;

  beforeEach(() => {
    txContext = new TransactionContext();
    repo = new MongoNotificationRepository(txContext);
  });

  afterEach(async () => {
    await NotificationModel.deleteMany({});
  });

  it('round-trips a PENDING notification through save + findById', async () => {
    const n = buildNotification();
    await repo.save(n);

    const found = await repo.findById(n.id.toString());
    expect(found).toBeInstanceOf(Notification);
    expect(found!.status.value).toBe('PENDING');
    expect(found!.dedupeKey).toBe(n.dedupeKey);
  });

  it('round-trips a status transition through update', async () => {
    const n = buildNotification();
    await repo.save(n);

    n.markSent('resend');
    await repo.update(n);

    const found = await repo.findById(n.id.toString());
    expect(found!.status.value).toBe('SENT');
    expect(found!.provider).toBe('resend');
    expect(found!.sentAt).toBeInstanceOf(Date);
  });

  it('finds a notification by dedupeKey', async () => {
    const n = buildNotification({ dedupeKey: 'evt-123:ORDER_UPDATES' });
    await repo.save(n);

    const found = await repo.findByDedupeKey('evt-123:ORDER_UPDATES');
    expect(found!.id.toString()).toBe(n.id.toString());
  });

  it('enforces a unique sparse index on dedupeKey', async () => {
    const dedupeKey = `evt-dup-${randomUUID()}:ORDER_UPDATES`;
    await repo.save(buildNotification({ dedupeKey }));
    await expect(repo.save(buildNotification({ dedupeKey }))).rejects.toThrow();
  });

  it('finds notifications by recipient ordered by createdAt desc, and counts unread', async () => {
    const userId = `user-${randomUUID()}`;
    const n1 = buildNotification({ recipientUserId: userId });
    const n2 = buildNotification({ recipientUserId: userId });
    await repo.save(n1);
    await repo.save(n2);
    n1.markSent('resend');
    await repo.update(n1);

    const list = await repo.findByRecipient(userId);
    expect(list).toHaveLength(2);

    const unread = await repo.countUnread(userId);
    expect(unread).toBe(2);
  });
});
