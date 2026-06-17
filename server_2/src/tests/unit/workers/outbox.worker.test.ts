const mockOutboxProcessor = { start: jest.fn(), stop: jest.fn().mockResolvedValue(undefined) };
const mockApp = { outboxProcessor: mockOutboxProcessor } as unknown;

const mockBootstrap = jest.fn().mockResolvedValue(mockApp);
const mockShutdown = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../container', () => ({
  bootstrap: mockBootstrap,
  shutdown: mockShutdown,
}));

const mockRunWorker = jest.fn();
jest.mock('../../../workers/shared/runWorker', () => ({
  runWorker: mockRunWorker,
}));

jest.mock('../../../infrastructure/observability/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { run } from '../../../workers/outbox.worker';

describe('outbox.worker', () => {
  beforeEach(() => {
    mockOutboxProcessor.start.mockClear();
    mockOutboxProcessor.stop.mockClear();
    mockBootstrap.mockResolvedValue(mockApp);
    mockShutdown.mockResolvedValue(undefined);
  });

  it('bootstraps with the poller disabled, then starts the OutboxProcessor itself', async () => {
    await run();

    expect(mockBootstrap).toHaveBeenCalledWith({ startOutboxProcessor: false });
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
