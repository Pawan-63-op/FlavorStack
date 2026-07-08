import { Notification, NotificationProps } from '../../../domain/engagement/entities/Notification';
import { NotificationStatus } from '../../../domain/engagement/value-objects/NotificationStatus';
import { NotificationStatusValue } from '../../../domain/engagement/enums/notification-status.enum';
import { NotificationCategoryValue } from '../../../domain/engagement/enums/notification-category.enum';
import { NotificationChannelValue } from '../../../domain/engagement/enums/notification-channel.enum';
import { UniqueEntityId } from '../../../domain/shared/UniqueEntityId';
import { NotificationDocument } from '../models/NotificationModel';
import { rebuildOrThrow } from './rebuildOrThrow';

export class NotificationMapper {
  static toPersistence(notification: Notification): NotificationDocument {
    return {
      _id: notification.id.toString(),
      recipientUserId: notification.recipientUserId,
      category: notification.category,
      channel: notification.channel,
      templateKey: notification.templateKey,
      renderedTitle: notification.renderedTitle,
      renderedBody: notification.renderedBody,
      status: notification.status.value,
      dedupeKey: notification.dedupeKey,
      provider: notification.provider,
      createdAt: notification.createdAt,
      sentAt: notification.sentAt,
      failedReason: notification.failedReason,
      readAt: notification.readAt,
    };
  }

  static toDomain(doc: NotificationDocument): Notification {
    const status = rebuildOrThrow(
      NotificationStatus.create(doc.status as NotificationStatusValue),
      `Notification status (${doc._id})`
    );

    const props: NotificationProps = {
      recipientUserId: doc.recipientUserId,
      category: doc.category as NotificationCategoryValue,
      channel: doc.channel as NotificationChannelValue,
      templateKey: doc.templateKey,
      renderedTitle: doc.renderedTitle,
      renderedBody: doc.renderedBody,
      status,
      dedupeKey: doc.dedupeKey,
      provider: doc.provider,
      createdAt: doc.createdAt,
      sentAt: doc.sentAt,
      failedReason: doc.failedReason,
      readAt: doc.readAt,
    };

    return Notification.reconstitute(props, new UniqueEntityId(doc._id));
  }
}
