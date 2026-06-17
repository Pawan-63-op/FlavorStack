type WorkerHandler = (...args: unknown[]) => void;

interface FakeWorker {
  processor: (job: unknown) => Promise<void>;
  handlers: Record<string, WorkerHandler>;
  on: jest.Mock;
  close: jest.Mock;
}

jest.mock('bullmq', () => ({ Worker: jest.fn() }));

import { Worker } from 'bullmq';
import { EmailWorker } from '../../../../../infrastructure/workers/email/EmailWorker';
import { QUEUE } from '../../../../../config/bullmq';
import { IEmailProvider } from '../../../../../domain/identity/services/IEmailProvider';
import { DLQHandler } from '../../../../../infrastructure/workers/shared/DLQHandler';
import { JobLogger } from '../../../../../infrastructure/workers/shared/JobLogger';

function getFakeWorker(): FakeWorker {
  return (Worker as unknown as jest.Mock).mock.instances[0] as FakeWorker;
}

describe('EmailWorker', () => {
  let emailProvider: jest.Mocked<IEmailProvider>;
  let dlqHandler: jest.Mocked<DLQHandler>;
  let jobLogger: jest.Mocked<JobLogger>;

  beforeEach(() => {
    (Worker as unknown as jest.Mock).mockImplementation(function (
      this: FakeWorker,
      _queue: string,
      processor: (job: unknown) => Promise<void>,
    ) {
      this.processor = processor;
      this.handlers = {};
      this.on = jest.fn((event: string, handler: WorkerHandler) => {
        this.handlers[event] = handler;
      });
      this.close = jest.fn().mockResolvedValue(undefined);
    });

    emailProvider = {
      sendVerification: jest.fn().mockResolvedValue(undefined),
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
      sendNotification: jest.fn().mockResolvedValue(undefined),
    };
    dlqHandler = { handle: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<DLQHandler>;
    jobLogger = { register: jest.fn() } as unknown as jest.Mocked<JobLogger>;
  });

  it('constructs a BullMQ Worker for email-queue and registers the job logger', () => {
    new EmailWorker(emailProvider, dlqHandler, jobLogger);

    expect(Worker).toHaveBeenCalledWith(QUEUE.email, expect.any(Function), expect.objectContaining({ connection: expect.anything() }));
    expect(jobLogger.register).toHaveBeenCalledWith(getFakeWorker());
  });

  it('sends a welcome notification for a "welcome" job', async () => {
    new EmailWorker(emailProvider, dlqHandler, jobLogger);

    await getFakeWorker().processor({ data: { type: 'welcome', to: 'user@example.com', name: 'Ada' } });

    expect(emailProvider.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'user@example.com' }),
      'Welcome to FlavorStack',
      expect.stringContaining('Ada'),
    );
  });

  it('sends a password-reset notification for a "password-reset" job', async () => {
    new EmailWorker(emailProvider, dlqHandler, jobLogger);

    await getFakeWorker().processor({ data: { type: 'password-reset', to: 'user@example.com' } });

    expect(emailProvider.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'user@example.com' }),
      'Password Reset Requested',
      expect.any(String),
    );
  });

  it('sends a verification email for a "verification" job', async () => {
    new EmailWorker(emailProvider, dlqHandler, jobLogger);

    await getFakeWorker().processor({ data: { type: 'verification', to: 'user@example.com', token: 'tok-123' } });

    expect(emailProvider.sendVerification).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'user@example.com' }),
      'tok-123',
    );
  });

  it('sends a generic notification for a "notification" job', async () => {
    new EmailWorker(emailProvider, dlqHandler, jobLogger);

    await getFakeWorker().processor({ data: { type: 'notification', to: 'user@example.com', subject: 'Subj', body: 'Body' } });

    expect(emailProvider.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'user@example.com' }),
      'Subj',
      'Body',
    );
  });

  it('throws for an invalid recipient email without calling the provider', async () => {
    new EmailWorker(emailProvider, dlqHandler, jobLogger);

    await expect(
      getFakeWorker().processor({ data: { type: 'welcome', to: 'not-an-email', name: 'Ada' } }),
    ).rejects.toThrow(/Invalid recipient email/);

    expect(emailProvider.sendNotification).not.toHaveBeenCalled();
  });

  it('propagates provider errors so BullMQ can retry', async () => {
    emailProvider.sendNotification.mockRejectedValue(new Error('Resend unreachable'));
    new EmailWorker(emailProvider, dlqHandler, jobLogger);

    await expect(
      getFakeWorker().processor({ data: { type: 'welcome', to: 'user@example.com', name: 'Ada' } }),
    ).rejects.toThrow('Resend unreachable');
  });

  it('routes an exhausted job to the DLQ via the failed handler', () => {
    new EmailWorker(emailProvider, dlqHandler, jobLogger);

    const job = { attemptsMade: 3, opts: { attempts: 3 }, name: 'welcome', data: {} };
    const err = new Error('boom');

    getFakeWorker().handlers.failed(job, err);

    expect(dlqHandler.handle).toHaveBeenCalledWith(QUEUE.email, job, err);
  });

  it('does not route a job to the DLQ while retry attempts remain', () => {
    new EmailWorker(emailProvider, dlqHandler, jobLogger);

    const job = { attemptsMade: 1, opts: { attempts: 3 }, name: 'welcome', data: {} };
    const err = new Error('boom');

    getFakeWorker().handlers.failed(job, err);

    expect(dlqHandler.handle).not.toHaveBeenCalled();
  });

  it('closes the underlying BullMQ worker', async () => {
    const worker = new EmailWorker(emailProvider, dlqHandler, jobLogger);

    await worker.close();

    expect(getFakeWorker().close).toHaveBeenCalledTimes(1);
  });
});
