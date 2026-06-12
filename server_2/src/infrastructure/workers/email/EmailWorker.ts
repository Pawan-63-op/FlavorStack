// BullMQ Worker consuming `email-queue` — maps EmailJob.type to IEmailProvider calls.
import { Job, Worker } from 'bullmq';

import { IEmailProvider } from '../../../domain/identity/services/IEmailProvider';
import { Email } from '../../../domain/identity/value-objects/Email.vo';
import { EmailJob } from '../../../application/shared/queues/jobs';
import { getBullConnection, QUEUE } from '../../../config/bullmq';
import { DLQHandler } from '../shared/DLQHandler';
import { JobLogger } from '../shared/JobLogger';

export class EmailWorker {
  private readonly worker: Worker<EmailJob>;

  constructor(
    private readonly emailProvider: IEmailProvider,
    dlqHandler: DLQHandler,
    jobLogger: JobLogger,
  ) {
    this.worker = new Worker<EmailJob>(QUEUE.email, (job) => this.process(job), {
      connection: getBullConnection(),
    });

    jobLogger.register(this.worker);

    this.worker.on('failed', (job, err) => {
      if (!job) return;

      const maxAttempts = job.opts.attempts ?? 1;
      if (job.attemptsMade >= maxAttempts) {
        void dlqHandler.handle(QUEUE.email, job, err);
      }
    });
  }

  async process(job: Job<EmailJob>): Promise<void> {
    const data = job.data;
    const emailResult = Email.create(data.to);
    if (emailResult.isFailure) {
      throw new Error(`Invalid recipient email: ${data.to}`);
    }
    const to = emailResult.getValue();

    switch (data.type) {
      case 'welcome':
        await this.emailProvider.sendNotification(
          to,
          'Welcome to FlavorStack',
          `Hi ${data.name}, your account has been created. Please verify your email to get started.`,
        );
        return;
      case 'password-reset':
        await this.emailProvider.sendNotification(
          to,
          'Password Reset Requested',
          'A password reset was requested for your account. If this was you, check your messages for the reset code we sent.',
        );
        return;
      case 'verification':
        await this.emailProvider.sendVerification(to, data.token);
        return;
      case 'notification':
        await this.emailProvider.sendNotification(to, data.subject, data.body);
        return;
    }
  }

  async close(): Promise<void> {
    await this.worker.close();
  }
}
