import type { ClientSession } from 'mongoose';
import { INotificationTemplateRepository } from '../../domain/engagement/repositories/INotificationTemplateRepository';
import { NotificationTemplate } from '../../domain/engagement/entities/NotificationTemplate';
import { NotificationChannelValue } from '../../domain/engagement/enums/notification-channel.enum';
import { ConflictError } from '../../domain/shared/errors/ConflictError';
import { TransactionContext } from '../database/TransactionContext';
import {
  NotificationTemplateModel,
  NotificationTemplateDocument,
} from '../database/models/NotificationTemplateModel';
import { NotificationTemplateMapper } from '../database/mappers/NotificationTemplateMapper';

function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: number };
  return e?.code === 11000;
}

export class MongoNotificationTemplateRepository implements INotificationTemplateRepository {
  constructor(private readonly txContext: TransactionContext) {}

  private get session(): ClientSession | undefined {
    return this.txContext.getSession();
  }

  async findByKeyChannelLocale(
    key: string,
    channel: NotificationChannelValue,
    locale: string
  ): Promise<NotificationTemplate | null> {
    const doc = await NotificationTemplateModel.findOne({ key, channel, locale }, null, {
      session: this.session,
    }).lean<NotificationTemplateDocument>();
    return doc ? NotificationTemplateMapper.toDomain(doc) : null;
  }

  async save(template: NotificationTemplate): Promise<void> {
    const doc = NotificationTemplateMapper.toPersistence(template);
    try {
      await NotificationTemplateModel.replaceOne({ _id: doc._id }, doc, {
        upsert: true,
        session: this.session,
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        throw new ConflictError('Notification template already exists for this key/channel/locale', {
          key: template.key,
          channel: template.channel,
          locale: template.locale,
        });
      }
      throw err;
    }
  }
}
