import { EmailJob, EnqueueOptions } from './jobs';

export interface IEmailQueue {
  enqueue(job: EmailJob, opts?: EnqueueOptions): Promise<void>;
  close(): Promise<void>;
}
