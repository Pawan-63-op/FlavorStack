import { NotificationPreference } from '../entities/NotificationPreference';

export interface INotificationPreferenceRepository {
  save(preference: NotificationPreference): Promise<void>;
  findByUserId(userId: string): Promise<NotificationPreference | null>;
}
