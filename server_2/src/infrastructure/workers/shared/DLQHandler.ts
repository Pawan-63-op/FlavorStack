// Dead Letter Queue — routes exhausted jobs from any source queue to `dead-letter-queue`
import type { Job, Queue } from 'bullmq';
import { QUEUE } from '../../../config/bullmq';

export interface DeadLetterPayload {
  sourceQueue: string;
  jobName: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
}

/** Copies an exhausted job (payload + failure context) onto `dead-letter-queue` for inspection/alerting. */
export class DLQHandler {
  constructor(private readonly dlqQueue: Queue) {}

  async handle(sourceQueue: string, job: Job, err: Error): Promise<void> {
    const payload: DeadLetterPayload = {
      sourceQueue,
      jobName: job.name,
      data: job.data,
      failedReason: err.message,
      attemptsMade: job.attemptsMade,
    };

    await this.dlqQueue.add(QUEUE.dlq, payload);
  }
}
