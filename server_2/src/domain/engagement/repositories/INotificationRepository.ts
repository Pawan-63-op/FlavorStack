import { Notification } from '../entities/Notification';

export interface FindNotificationsByRecipientQuery {
  limit?: number;
  offset?: number;
}

export interface INotificationRepository {
  save(notification: Notification): Promise<void>;
  update(notification: Notification): Promise<void>;
  findById(id: string): Promise<Notification | null>;
  findByDedupeKey(dedupeKey: string): Promise<Notification | null>;
  findByRecipient(userId: string, query?: FindNotificationsByRecipientQuery): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
}
