import { Job, Worker } from 'bullmq';

import { IEmailProvider } from '../../../domain/identity/services/IEmailProvider';
import { Email } from '../../../domain/identity/value-objects/Email.vo';
import { EmailJob } from '../../../application/shared/queues/jobs';
import { getBullConnection, QUEUE } from '../../../config/bullmq';
import { JobLogger } from '../shared/JobLogger';

export class EmailWorker {
  private readonly worker: Worker<EmailJob>;

  constructor(
    private readonly emailProvider: IEmailProvider,
    jobLogger: JobLogger,
  ) {
    this.worker = new Worker<EmailJob>(QUEUE.email, (job) => this.process(job), {
      connection: getBullConnection(),
    });

    // An exhausted job is retained by `removeOnFail: false` and logged by `jobLogger` — there
    // is no dead-letter copy to make (Phase 8).
    jobLogger.register(this.worker);
  }

  async process(job: Job<EmailJob>): Promise<void> {
    const data = job.data;
    const emailResult = Email.create(data.to);
    if (emailResult.isFailure) {
      throw new Error(`Invalid recipient email: ${data.to}`);
    }
    const to = emailResult.getValue();

    // Transport only — every job arrives pre-rendered from `notification_templates` (Phase 5
    // Batch 3). No copy lives in this worker.
    await this.emailProvider.sendNotification(to, data.subject, data.body);
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
