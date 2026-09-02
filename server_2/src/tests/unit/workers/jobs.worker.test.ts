const mockFulfillmentJobHandler = { handle: jest.fn() };
const mockApp = {
  fulfillment: { fulfillmentJobHandler: mockFulfillmentJobHandler },
} as unknown;

const mockBootstrapWorker = jest.fn().mockResolvedValue(mockApp);
const mockShutdown = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../container', () => ({
  bootstrapWorker: mockBootstrapWorker,
  shutdown: mockShutdown,
}));

const mockEmailProvider = { send: jest.fn() };
const mockEmailJobLogger = { register: jest.fn() };
const mockBuildEmailWorkerDeps = jest.fn(() => ({
  emailProvider: mockEmailProvider,
  jobLogger: mockEmailJobLogger,
}));
jest.mock('../../../container/worker.container', () => ({
  buildEmailWorkerDeps: mockBuildEmailWorkerDeps,
}));

const mockEmailClose = jest.fn().mockResolvedValue(undefined);
const mockEmailWorker = jest.fn().mockImplementation(() => ({ close: mockEmailClose }));
jest.mock('../../../infrastructure/workers/email/EmailWorker', () => ({
  EmailWorker: mockEmailWorker,
}));

const mockFulfillmentClose = jest.fn().mockResolvedValue(undefined);
const mockFulfillmentWorker = jest.fn().mockImplementation(() => ({ close: mockFulfillmentClose }));
jest.mock('../../../infrastructure/workers/fulfillment/FulfillmentWorker', () => ({
  FulfillmentWorker: mockFulfillmentWorker,
}));

const mockRunWorker = jest.fn();
jest.mock('../../../workers/shared/runWorker', () => ({
  runWorker: mockRunWorker,
}));

jest.mock('../../../infrastructure/observability/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { run } from '../../../workers/jobs.worker';
import { QUEUE } from '../../../config/bullmq';
import { JobLogger } from '../../../infrastructure/workers/shared/JobLogger';

describe('jobs.worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBootstrapWorker.mockResolvedValue(mockApp);
    mockShutdown.mockResolvedValue(undefined);
    mockBuildEmailWorkerDeps.mockReturnValue({
      emailProvider: mockEmailProvider,
      jobLogger: mockEmailJobLogger,
    });
    mockEmailWorker.mockImplementation(() => ({ close: mockEmailClose }));
    mockFulfillmentWorker.mockImplementation(() => ({ close: mockFulfillmentClose }));
  });

  it('runs one Worker per queue in a single process', async () => {
    await run();

    expect(mockBootstrapWorker).toHaveBeenCalledWith('jobs');
    expect(mockEmailWorker).toHaveBeenCalledTimes(1);
    expect(mockEmailWorker).toHaveBeenCalledWith(mockEmailProvider, mockEmailJobLogger);
    expect(mockFulfillmentWorker).toHaveBeenCalledTimes(1);

    // The fulfillment worker now builds its own logger — `buildFulfillmentWorkerDeps` is gone.
    const [handler, jobLogger] = mockFulfillmentWorker.mock.calls[0] as [unknown, JobLogger];
    expect(handler).toBe(mockFulfillmentJobHandler);
    expect(jobLogger).toBeInstanceOf(JobLogger);
    expect((jobLogger as unknown as { queue: string }).queue).toBe(QUEUE.fulfillment);
  });

  it('asserts the Resend key before connecting to Mongo or Redis (fail fast)', async () => {
    await run();

    expect(mockBuildEmailWorkerDeps.mock.invocationCallOrder[0]).toBeLessThan(
      mockBootstrapWorker.mock.invocationCallOrder[0],
    );
  });

  it('does not bootstrap at all when the Resend key is missing', async () => {
    mockBuildEmailWorkerDeps.mockImplementation(() => {
      throw new Error('Missing required environment variables: RESEND_API_KEY');
    });

    await expect(run()).rejects.toThrow(/RESEND_API_KEY/);
    expect(mockBootstrapWorker).not.toHaveBeenCalled();
  });

  it('registers a shutdown handler that closes both workers, then the container', async () => {
    await run();

    expect(mockRunWorker).toHaveBeenCalledTimes(1);
    const shutdownFn = mockRunWorker.mock.calls[0][0] as () => Promise<void>;

    await shutdownFn();

    expect(mockEmailClose).toHaveBeenCalledTimes(1);
    expect(mockFulfillmentClose).toHaveBeenCalledTimes(1);
    expect(mockShutdown).toHaveBeenCalledWith(mockApp);
    expect(mockEmailClose.mock.invocationCallOrder[0]).toBeLessThan(
      mockShutdown.mock.invocationCallOrder[0],
    );
    expect(mockFulfillmentClose.mock.invocationCallOrder[0]).toBeLessThan(
      mockShutdown.mock.invocationCallOrder[0],
    );
  });
});
