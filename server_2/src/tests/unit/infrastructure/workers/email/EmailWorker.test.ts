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
import { JobLogger } from '../../../../../infrastructure/workers/shared/JobLogger';

function getFakeWorker(): FakeWorker {
  return (Worker as unknown as jest.Mock).mock.instances[0] as FakeWorker;
}

describe('EmailWorker', () => {
  let emailProvider: jest.Mocked<IEmailProvider>;
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
      sendNotification: jest.fn().mockResolvedValue(undefined),
    };
    jobLogger = { register: jest.fn() } as unknown as jest.Mocked<JobLogger>;
  });

  it('constructs a BullMQ Worker for email-queue and registers the job logger', () => {
    new EmailWorker(emailProvider, jobLogger);

    expect(Worker).toHaveBeenCalledWith(QUEUE.email, expect.any(Function), expect.objectContaining({ connection: expect.anything() }));
    expect(jobLogger.register).toHaveBeenCalledWith(getFakeWorker());
  });

  it('ships the pre-rendered subject and body of a "notification" job', async () => {
    new EmailWorker(emailProvider, jobLogger);

    await getFakeWorker().processor({ data: { type: 'notification', to: 'user@example.com', subject: 'Subj', body: 'Body' } });

    expect(emailProvider.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'user@example.com' }),
      'Subj',
      'Body',
    );
  });

  it('throws for an invalid recipient email without calling the provider', async () => {
    new EmailWorker(emailProvider, jobLogger);

    await expect(
      getFakeWorker().processor({ data: { type: 'notification', to: 'not-an-email', subject: 'S', body: 'B' } }),
    ).rejects.toThrow(/Invalid recipient email/);

    expect(emailProvider.sendNotification).not.toHaveBeenCalled();
  });

  it('propagates provider errors so BullMQ can retry', async () => {
    emailProvider.sendNotification.mockRejectedValue(new Error('Resend unreachable'));
    new EmailWorker(emailProvider, jobLogger);

    await expect(
      getFakeWorker().processor({ data: { type: 'notification', to: 'user@example.com', subject: 'S', body: 'B' } }),
    ).rejects.toThrow('Resend unreachable');
  });

  // Phase 8: the dead-letter queue is gone. The worker registers no `failed` handler of its
  // own — an exhausted job is logged by JobLogger and retained in `bull:email-queue:failed`
  // by `removeOnFail: false`, so nothing here may swallow or re-route it.
  it('registers no failure handler beyond the job logger', () => {
    new EmailWorker(emailProvider, jobLogger);

    expect(getFakeWorker().on).not.toHaveBeenCalled();
  });

  it('closes the underlying BullMQ worker', async () => {
    const worker = new EmailWorker(emailProvider, jobLogger);

    await worker.close();

    expect(getFakeWorker().close).toHaveBeenCalledTimes(1);
  });
});
