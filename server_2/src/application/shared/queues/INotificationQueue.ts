import { NotificationJob, EnqueueOptions } from './jobs';

export interface INotificationQueue {
  enqueue(job: NotificationJob, opts?: EnqueueOptions): Promise<void>;
  close(): Promise<void>;
}
