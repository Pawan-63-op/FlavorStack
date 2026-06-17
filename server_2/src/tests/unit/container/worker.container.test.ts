jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(function (this: { add: jest.Mock; close: jest.Mock }) {
    this.add = jest.fn();
    this.close = jest.fn();
  }),
}));

import { Queue } from 'bullmq';
import { buildEmailWorkerDeps, buildNotificationWorkerDeps } from '../../../container/worker.container';
import { ResendEmailProvider } from '../../../infrastructure/external/email/ResendEmailProvider';
import { LoggerPushProvider } from '../../../infrastructure/external/push/LoggerPushProvider';
import { DLQHandler } from '../../../infrastructure/workers/shared/DLQHandler';
import { JobLogger } from '../../../infrastructure/workers/shared/JobLogger';
import { QUEUE } from '../../../config/bullmq';

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
      expect(deps.dlqHandler).toBeInstanceOf(DLQHandler);
      expect(deps.jobLogger).toBeInstanceOf(JobLogger);
      expect(deps.dlqQueue).toBeInstanceOf(Queue);
      expect(Queue).toHaveBeenCalledWith(QUEUE.dlq, expect.objectContaining({ connection: expect.anything() }));
    });
  });

  describe('buildNotificationWorkerDeps', () => {
    it('builds notification worker dependencies with no required env', () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.JWT_PRIVATE_KEY;
      delete process.env.JWT_PUBLIC_KEY;

      const deps = buildNotificationWorkerDeps();

      expect(deps.pushProvider).toBeInstanceOf(LoggerPushProvider);
      expect(deps.dlqHandler).toBeInstanceOf(DLQHandler);
      expect(deps.jobLogger).toBeInstanceOf(JobLogger);
      expect(deps.dlqQueue).toBeInstanceOf(Queue);
      expect(Queue).toHaveBeenCalledWith(QUEUE.dlq, expect.objectContaining({ connection: expect.anything() }));
    });
  });
});
