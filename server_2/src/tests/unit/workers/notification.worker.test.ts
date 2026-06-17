const mockDeps = {
  pushProvider: { name: 'pushProvider' },
  dlqQueue: { close: jest.fn().mockResolvedValue(undefined) },
  dlqHandler: { name: 'dlqHandler' },
  jobLogger: { name: 'jobLogger' },
};

const mockBuildNotificationWorkerDeps = jest.fn(() => mockDeps);
jest.mock('../../../container/worker.container', () => ({
  buildNotificationWorkerDeps: mockBuildNotificationWorkerDeps,
}));

const mockWorkerInstance = { close: jest.fn().mockResolvedValue(undefined) };
const MockNotifyWorker = jest.fn(() => mockWorkerInstance);
jest.mock('../../../infrastructure/workers/notification/NotifyWorker', () => ({
  NotifyWorker: MockNotifyWorker,
}));

const mockRunWorker = jest.fn();
jest.mock('../../../workers/shared/runWorker', () => ({
  runWorker: mockRunWorker,
}));

jest.mock('../../../infrastructure/observability/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { run } from '../../../workers/notification.worker';

describe('notification.worker', () => {
  beforeEach(() => {
    mockBuildNotificationWorkerDeps.mockReturnValue(mockDeps);
    MockNotifyWorker.mockReturnValue(mockWorkerInstance);
    mockWorkerInstance.close.mockClear();
    mockDeps.dlqQueue.close.mockClear();
  });

  it('builds scoped notification worker deps and starts a BullMQ NotifyWorker', async () => {
    await run();

    expect(mockBuildNotificationWorkerDeps).toHaveBeenCalledTimes(1);
    expect(MockNotifyWorker).toHaveBeenCalledWith(
      mockDeps.pushProvider,
      mockDeps.dlqHandler,
      mockDeps.jobLogger,
    );
  });

  it('registers a shutdown handler that closes the worker and the DLQ queue', async () => {
    await run();

    expect(mockRunWorker).toHaveBeenCalledTimes(1);
    const shutdownFn = mockRunWorker.mock.calls[0][0] as () => Promise<void>;

    await shutdownFn();

    expect(mockWorkerInstance.close).toHaveBeenCalledTimes(1);
    expect(mockDeps.dlqQueue.close).toHaveBeenCalledTimes(1);
  });
});
