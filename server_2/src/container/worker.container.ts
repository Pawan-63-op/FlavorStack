import { getEmailConfig } from '../config/email';
import { QUEUE } from '../config/bullmq';
import { IEmailProvider } from '../domain/identity/services/IEmailProvider';
import { ResendEmailProvider } from '../infrastructure/external/email/ResendEmailProvider';
import { JobLogger } from '../infrastructure/workers/shared/JobLogger';

export interface EmailWorkerDeps {
  emailProvider: IEmailProvider;
  jobLogger: JobLogger;
}

/** EmailWorker needs Resend; it never touches JWT keys so `assertRequiredConfig()` would over-assert. */
function assertEmailWorkerConfig(): void {
  if (!getEmailConfig().apiKey) {
    throw new Error('Missing required environment variables: RESEND_API_KEY');
  }
}

export function buildEmailWorkerDeps(): EmailWorkerDeps {
  assertEmailWorkerConfig();

  return {
    emailProvider: new ResendEmailProvider(getEmailConfig()),
    jobLogger: new JobLogger(QUEUE.email),
  };
}
