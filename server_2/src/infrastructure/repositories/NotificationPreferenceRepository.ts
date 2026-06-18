import type { ClientSession } from 'mongoose';
import { INotificationPreferenceRepository } from '../../domain/engagement/repositories/INotificationPreferenceRepository';
import { NotificationPreference } from '../../domain/engagement/entities/NotificationPreference';
import { ConflictError } from '../../domain/shared/errors/ConflictError';
import { TransactionContext } from '../database/TransactionContext';
import {
  NotificationPreferenceModel,
  NotificationPreferenceDocument,
} from '../database/models/NotificationPreferenceModel';
import { NotificationPreferenceMapper } from '../database/mappers/NotificationPreferenceMapper';

function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: number };
  return e?.code === 11000;
}

export class MongoNotificationPreferenceRepository implements INotificationPreferenceRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  async findByUserId(userId: string): Promise<NotificationPreference | null> {
    const doc = await NotificationPreferenceModel.findOne({ userId }, null, {
      session: this.session,
    }).lean<NotificationPreferenceDocument>();
    return doc ? NotificationPreferenceMapper.toDomain(doc) : null;
  }

  async save(preference: NotificationPreference): Promise<void> {
    const doc = NotificationPreferenceMapper.toPersistence(preference);
    try {
      await NotificationPreferenceModel.replaceOne({ _id: doc._id }, doc, {
        upsert: true,
        session: this.session,
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new ConflictError('Notification preference already exists for this user', {
          userId: preference.userId,
        });
      }
      throw err;
    }
  }
}
