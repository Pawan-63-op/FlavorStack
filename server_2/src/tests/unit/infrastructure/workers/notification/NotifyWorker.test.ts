type WorkerHandler = (...args: unknown[]) => void;

interface FakeWorker {
  processor: (job: unknown) => Promise<void>;
  handlers: Record<string, WorkerHandler>;
  on: jest.Mock;
  close: jest.Mock;
}

jest.mock('bullmq', () => ({ Worker: jest.fn() }));

import { Worker } from 'bullmq';
import { NotifyWorker } from '../../../../../infrastructure/workers/notification/NotifyWorker';
import { QUEUE } from '../../../../../config/bullmq';
import { IPushProvider } from '../../../../../infrastructure/external/push/IPushProvider';
import { DLQHandler } from '../../../../../infrastructure/workers/shared/DLQHandler';
import { JobLogger } from '../../../../../infrastructure/workers/shared/JobLogger';

function getFakeWorker(): FakeWorker {
  return (Worker as unknown as jest.Mock).mock.instances[0] as FakeWorker;
}

describe('NotifyWorker', () => {
  let pushProvider: jest.Mocked<IPushProvider>;
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

    pushProvider = { sendPush: jest.fn().mockResolvedValue(undefined) };
    dlqHandler = { handle: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<DLQHandler>;
    jobLogger = { register: jest.fn() } as unknown as jest.Mocked<JobLogger>;
  });

  it('constructs a BullMQ Worker for notification-queue and registers the job logger', () => {
    new NotifyWorker(pushProvider, dlqHandler, jobLogger);

    expect(Worker).toHaveBeenCalledWith(QUEUE.notification, expect.any(Function), expect.objectContaining({ connection: expect.anything() }));
    expect(jobLogger.register).toHaveBeenCalledWith(getFakeWorker());
  });

  it('sends a push notification for a "push" job', async () => {
    new NotifyWorker(pushProvider, dlqHandler, jobLogger);

    await getFakeWorker().processor({
      data: { type: 'push', token: 'device-token', title: 'Order ready', body: 'Pick it up', data: { orderId: '123' } },
    });

    expect(pushProvider.sendPush).toHaveBeenCalledWith('device-token', 'Order ready', 'Pick it up', { orderId: '123' });
  });

  it('propagates provider errors so BullMQ can retry', async () => {
    pushProvider.sendPush.mockRejectedValue(new Error('FCM unreachable'));
    new NotifyWorker(pushProvider, dlqHandler, jobLogger);

    await expect(
      getFakeWorker().processor({ data: { type: 'push', token: 'device-token', title: 'Hi', body: 'There' } }),
    ).rejects.toThrow('FCM unreachable');
  });

  it('routes an exhausted job to the DLQ via the failed handler', () => {
    new NotifyWorker(pushProvider, dlqHandler, jobLogger);

    const job = { attemptsMade: 3, opts: { attempts: 3 }, name: 'push', data: {} };
    const err = new Error('boom');

    getFakeWorker().handlers.failed(job, err);

    expect(dlqHandler.handle).toHaveBeenCalledWith(QUEUE.notification, job, err);
  });

  it('does not route a job to the DLQ while retry attempts remain', () => {
    new NotifyWorker(pushProvider, dlqHandler, jobLogger);

    const job = { attemptsMade: 1, opts: { attempts: 3 }, name: 'push', data: {} };
    const err = new Error('boom');

    getFakeWorker().handlers.failed(job, err);

    expect(dlqHandler.handle).not.toHaveBeenCalled();
  });

  it('closes the underlying BullMQ worker', async () => {
    const worker = new NotifyWorker(pushProvider, dlqHandler, jobLogger);

    await worker.close();

    expect(getFakeWorker().close).toHaveBeenCalledTimes(1);
  });
});
