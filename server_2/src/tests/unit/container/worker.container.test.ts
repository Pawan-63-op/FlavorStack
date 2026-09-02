import { buildEmailWorkerDeps } from '../../../container/worker.container';
import { ResendEmailProvider } from '../../../infrastructure/external/email/ResendEmailProvider';
import { JobLogger } from '../../../infrastructure/workers/shared/JobLogger';

describe('worker.container', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('buildEmailWorkerDeps', () => {
    it('throws when RESEND_API_KEY is missing', () => {
      delete process.env.RESEND_API_KEY;

      expect(() => buildEmailWorkerDeps()).toThrow(/RESEND_API_KEY/);
    });

    it('builds email worker dependencies without requiring JWT keys', () => {
      process.env.RESEND_API_KEY = 'test-key';
      delete process.env.JWT_PRIVATE_KEY;
      delete process.env.JWT_PUBLIC_KEY;

      const deps = buildEmailWorkerDeps();

      expect(deps.emailProvider).toBeInstanceOf(ResendEmailProvider);
      expect(deps.jobLogger).toBeInstanceOf(JobLogger);
    });

    // Phase 8: the dead-letter queue is gone, so building worker deps no longer opens a BullMQ
    // Queue at all. Exhausted jobs are retained in place by `removeOnFail: false`.
    it('opens no queue connection', () => {
      process.env.RESEND_API_KEY = 'test-key';

      expect(Object.keys(buildEmailWorkerDeps())).toEqual(['emailProvider', 'jobLogger']);
    });
  });
});
