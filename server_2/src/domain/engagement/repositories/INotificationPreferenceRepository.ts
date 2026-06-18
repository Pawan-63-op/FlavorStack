// Domain repository contract for the NotificationPreference aggregate (engagement_module.md §6).
import { NotificationPreference } from '../entities/NotificationPreference';

export interface INotificationPreferenceRepository {
  save(preference: NotificationPreference): Promise<void>;
  findByUserId(userId: string): Promise<NotificationPreference | null>;
}
