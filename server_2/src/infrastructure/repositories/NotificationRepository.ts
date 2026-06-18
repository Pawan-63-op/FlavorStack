import type { ClientSession } from 'mongoose';
import {
  INotificationRepository,
  FindNotificationsByRecipientQuery,
} from '../../domain/engagement/repositories/INotificationRepository';
import { Notification } from '../../domain/engagement/entities/Notification';
import { ConflictError } from '../../domain/shared/errors/ConflictError';
import { TransactionContext } from '../database/TransactionContext';
import { NotificationModel, NotificationDocument } from '../database/models/NotificationModel';
import { NotificationMapper } from '../database/mappers/NotificationMapper';
import { NOTIFICATION_STATUS } from '../../domain/engagement/enums/notification-status.enum';

function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: number };
  return e?.code === 11000;
}

export class MongoNotificationRepository implements INotificationRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  async findById(id: string): Promise<Notification | null> {
    const doc = await NotificationModel.findOne({ _id: id }, null, {
      session: this.session,
    }).lean<NotificationDocument>();
    return doc ? NotificationMapper.toDomain(doc) : null;
  }

  async findByDedupeKey(dedupeKey: string): Promise<Notification | null> {
    const doc = await NotificationModel.findOne({ dedupeKey }, null, {
      session: this.session,
    }).lean<NotificationDocument>();
    return doc ? NotificationMapper.toDomain(doc) : null;
  }

  async findByRecipient(
    userId: string,
    query?: FindNotificationsByRecipientQuery
  ): Promise<Notification[]> {
    const docs = await NotificationModel.find({ recipientUserId: userId }, null, {
      session: this.session,
    })
      .sort({ createdAt: -1 })
      .skip(query?.offset ?? 0)
      .limit(query?.limit ?? 0)
      .lean<NotificationDocument[]>();
    return docs.map(NotificationMapper.toDomain);
  }

  async countUnread(userId: string): Promise<number> {
    return NotificationModel.countDocuments({
      recipientUserId: userId,
      status: { $ne: NOTIFICATION_STATUS.READ },
    }).session(this.session ?? null);
  }

  async save(notification: Notification): Promise<void> {
    try {
      await NotificationModel.create([NotificationMapper.toPersistence(notification)], {
        session: this.session,
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new ConflictError('Notification already exists for this dedupeKey', {
          dedupeKey: notification.dedupeKey,
        });
      }
      throw err;
    }
  }

  async update(notification: Notification): Promise<void> {
    const doc = NotificationMapper.toPersistence(notification);
    await NotificationModel.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: doc.status,
          provider: doc.provider,
          sentAt: doc.sentAt,
          failedReason: doc.failedReason,
          readAt: doc.readAt,
        },
      },
      { session: this.session }
    );
  }
}
