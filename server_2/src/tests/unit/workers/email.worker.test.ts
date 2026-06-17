const mockDeps = {
  emailProvider: { name: 'emailProvider' },
  dlqQueue: { close: jest.fn().mockResolvedValue(undefined) },
  dlqHandler: { name: 'dlqHandler' },
  jobLogger: { name: 'jobLogger' },
};

const mockBuildEmailWorkerDeps = jest.fn(() => mockDeps);
jest.mock('../../../container/worker.container', () => ({
  buildEmailWorkerDeps: mockBuildEmailWorkerDeps,
}));

const mockWorkerInstance = { close: jest.fn().mockResolvedValue(undefined) };
const MockEmailWorker = jest.fn(() => mockWorkerInstance);
jest.mock('../../../infrastructure/workers/email/EmailWorker', () => ({
  EmailWorker: MockEmailWorker,
}));

const mockRunWorker = jest.fn();
jest.mock('../../../workers/shared/runWorker', () => ({
  runWorker: mockRunWorker,
}));

jest.mock('../../../infrastructure/observability/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { run } from '../../../workers/email.worker';

describe('email.worker', () => {
  beforeEach(() => {
    mockBuildEmailWorkerDeps.mockReturnValue(mockDeps);
    MockEmailWorker.mockReturnValue(mockWorkerInstance);
    mockWorkerInstance.close.mockClear();
    mockDeps.dlqQueue.close.mockClear();
  });

  it('builds scoped email worker deps and starts a BullMQ EmailWorker', async () => {
    await run();

    expect(mockBuildEmailWorkerDeps).toHaveBeenCalledTimes(1);
    expect(MockEmailWorker).toHaveBeenCalledWith(
      mockDeps.emailProvider,
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
