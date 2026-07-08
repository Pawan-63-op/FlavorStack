import { NotificationTemplate } from '../entities/NotificationTemplate';
import { NotificationChannelValue } from '../enums/notification-channel.enum';

export interface INotificationTemplateRepository {
  save(template: NotificationTemplate): Promise<void>;
  findByKeyChannelLocale(
    key: string,
    channel: NotificationChannelValue,
    locale: string
  ): Promise<NotificationTemplate | null>;
}
