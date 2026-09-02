const mockOutboxProcessor = { start: jest.fn(), stop: jest.fn().mockResolvedValue(undefined) };
const mockApp = { outboxProcessor: mockOutboxProcessor } as unknown;

const mockBootstrapWorker = jest.fn().mockResolvedValue(mockApp);
const mockShutdown = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../container', () => ({
  bootstrapWorker: mockBootstrapWorker,
  shutdown: mockShutdown,
}));

const mockRunWorker = jest.fn();
jest.mock('../../../workers/shared/runWorker', () => ({
  runWorker: mockRunWorker,
}));

jest.mock('../../../infrastructure/observability/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { run } from '../../../workers/relay.worker';

describe('relay.worker', () => {
  beforeEach(() => {
    mockOutboxProcessor.start.mockClear();
    mockOutboxProcessor.stop.mockClear();
    mockBootstrapWorker.mockClear();
    mockBootstrapWorker.mockResolvedValue(mockApp);
    mockShutdown.mockResolvedValue(undefined);
  });

  it('builds the narrow relay container, then starts the OutboxProcessor itself', async () => {
    await run();

    expect(mockBootstrapWorker).toHaveBeenCalledWith('relay');
    expect(mockOutboxProcessor.start).toHaveBeenCalledTimes(1);
  });

  it('registers a shutdown handler that tears down the whole app container', async () => {
    await run();

    expect(mockRunWorker).toHaveBeenCalledTimes(1);
    const shutdownFn = mockRunWorker.mock.calls[0][0] as () => Promise<void>;

    await shutdownFn();

    expect(mockShutdown).toHaveBeenCalledWith(mockApp);
  });
});
