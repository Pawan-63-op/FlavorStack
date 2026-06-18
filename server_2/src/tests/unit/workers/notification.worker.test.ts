const mockDeps = {
  pushProvider: { name: 'pushProvider' },
  dlqQueue: { close: jest.fn().mockResolvedValue(undefined) },
  dlqHandler: { name: 'dlqHandler' },
  jobLogger: { name: 'jobLogger' },
};

const mockApp = { notificationDispatcher: { name: 'notificationDispatcher' } };
const mockBootstrap = jest.fn().mockResolvedValue(mockApp);
const mockShutdown = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../container', () => ({
  bootstrap: mockBootstrap,
  shutdown: mockShutdown,
}));

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
    mockBootstrap.mockResolvedValue(mockApp);
    mockBuildNotificationWorkerDeps.mockReturnValue(mockDeps);
    MockNotifyWorker.mockReturnValue(mockWorkerInstance);
    mockWorkerInstance.close.mockClear();
    mockDeps.dlqQueue.close.mockClear();
    mockShutdown.mockClear();
  });

  it('bootstraps the graph (poller off) and starts a NotifyWorker with the app dispatcher', async () => {
    await run();

    expect(mockBootstrap).toHaveBeenCalledWith({ startOutboxProcessor: false });
    expect(mockBuildNotificationWorkerDeps).toHaveBeenCalledTimes(1);
    expect(MockNotifyWorker).toHaveBeenCalledWith(
      mockDeps.pushProvider,
      mockApp.notificationDispatcher,
      mockDeps.dlqHandler,
      mockDeps.jobLogger,
    );
  });

  it('registers a shutdown handler that closes the worker, the DLQ queue, and the app graph', async () => {
    await run();

    expect(mockRunWorker).toHaveBeenCalledTimes(1);
    const shutdownFn = mockRunWorker.mock.calls[0][0] as () => Promise<void>;

    await shutdownFn();

    expect(mockWorkerInstance.close).toHaveBeenCalledTimes(1);
    expect(mockDeps.dlqQueue.close).toHaveBeenCalledTimes(1);
    expect(mockShutdown).toHaveBeenCalledWith(mockApp);
  });
});
