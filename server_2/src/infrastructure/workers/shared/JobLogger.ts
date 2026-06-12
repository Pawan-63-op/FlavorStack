// Pino-based job lifecycle logger — registers active/completed/failed/stalled hooks on a BullMQ Worker
import type { Job, Worker } from 'bullmq';
import { logger } from '../../observability/logger';

export class JobLogger {
  constructor(private readonly queue: string) {}

  register(worker: Worker): void {
    worker.on('active', (job: Job) => {
      logger.info(this.context(job), 'job active');
    });

    worker.on('completed', (job: Job) => {
      logger.info(this.context(job), 'job completed');
    });

    worker.on('failed', (job: Job | undefined, err: Error) => {
      logger.error({ ...this.context(job), err: err.message }, 'job failed');
    });

    worker.on('stalled', (jobId: string) => {
      logger.warn({ queue: this.queue, jobId }, 'job stalled');
    });
  }

  private context(job?: Job): { queue: string; jobId?: string; jobName?: string; attemptsMade?: number } {
    return {
      queue: this.queue,
      jobId: job?.id,
      jobName: job?.name,
      attemptsMade: job?.attemptsMade,
    };
  }
}
