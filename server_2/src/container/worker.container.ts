// Minimal dependency graphs for the EmailWorker / NotificationWorker processes (Phase 11, Batch 1).
//
// Unlike `bootstrap()` / `assertRequiredConfig()`, these builders are scoped to what each
// worker actually touches: the EmailWorker needs Resend, the NotificationWorker needs
// nothing (LoggerPushProvider has no credentials). Neither requires the JWT key pair.
import { Queue } from 'bullmq';

import { getEmailConfig } from '../config/email';
import { getBullConnection, getDefaultJobOptions, QUEUE } from '../config/bullmq';
import { IEmailProvider } from '../domain/identity/services/IEmailProvider';
import { ResendEmailProvider } from '../infrastructure/external/email/ResendEmailProvider';
import { IPushProvider } from '../infrastructure/external/push/IPushProvider';
import { LoggerPushProvider } from '../infrastructure/external/push/LoggerPushProvider';
import { DLQHandler } from '../infrastructure/workers/shared/DLQHandler';
import { JobLogger } from '../infrastructure/workers/shared/JobLogger';

export interface EmailWorkerDeps {
  emailProvider: IEmailProvider;
  dlqQueue: Queue;
  dlqHandler: DLQHandler;
  jobLogger: JobLogger;
}

export interface NotificationWorkerDeps {
  pushProvider: IPushProvider;
  dlqQueue: Queue;
  dlqHandler: DLQHandler;
  jobLogger: JobLogger;
}

function buildDlqQueue(): Queue {
  return new Queue(QUEUE.dlq, {
    connection: getBullConnection(),
    defaultJobOptions: getDefaultJobOptions(),
  });
}

/** EmailWorker needs Resend; it never touches JWT keys so `assertRequiredConfig()` would over-assert. */
function assertEmailWorkerConfig(): void {
  if (!getEmailConfig().apiKey) {
    throw new Error('Missing required environment variables: RESEND_API_KEY');
  }
}

export function buildEmailWorkerDeps(): EmailWorkerDeps {
  assertEmailWorkerConfig();

  const dlqQueue = buildDlqQueue();

  return {
    emailProvider: new ResendEmailProvider(getEmailConfig()),
    dlqQueue,
    dlqHandler: new DLQHandler(dlqQueue),
    jobLogger: new JobLogger(QUEUE.email),
  };
}

/** NotificationWorker has no required env — `LoggerPushProvider` needs no credentials. */
export function buildNotificationWorkerDeps(): NotificationWorkerDeps {
  const dlqQueue = buildDlqQueue();

  return {
    pushProvider: new LoggerPushProvider(),
    dlqQueue,
    dlqHandler: new DLQHandler(dlqQueue),
    jobLogger: new JobLogger(QUEUE.notification),
  };
}
