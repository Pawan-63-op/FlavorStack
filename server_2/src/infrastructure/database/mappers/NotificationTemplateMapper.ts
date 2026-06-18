// Maps between the NotificationTemplate aggregate and NotificationTemplateModel documents
// (engagement_module.md §6). reconstitute() is faithful since the aggregate has no internal VOs.
import {
  NotificationTemplate,
  NotificationTemplateProps,
} from '../../../domain/engagement/entities/NotificationTemplate';
import { NotificationChannelValue } from '../../../domain/engagement/enums/notification-channel.enum';
import { UniqueEntityId } from '../../../domain/shared/UniqueEntityId';
import { NotificationTemplateDocument } from '../models/NotificationTemplateModel';

export class NotificationTemplateMapper {
  static toPersistence(template: NotificationTemplate): NotificationTemplateDocument {
    return {
      _id: template.id.toString(),
      key: template.key,
      channel: template.channel,
      locale: template.locale,
      titleTemplate: template.titleTemplate,
      bodyTemplate: template.bodyTemplate,
      active: template.active,
    };
  }

  static toDomain(doc: NotificationTemplateDocument): NotificationTemplate {
    const props: NotificationTemplateProps = {
      key: doc.key,
      channel: doc.channel as NotificationChannelValue,
      locale: doc.locale,
      titleTemplate: doc.titleTemplate,
      bodyTemplate: doc.bodyTemplate,
      active: doc.active,
    };

    return NotificationTemplate.reconstitute(props, new UniqueEntityId(doc._id));
  }
}
