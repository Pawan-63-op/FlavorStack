const mockRunRelayWorker = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../workers/relay.worker', () => ({ run: mockRunRelayWorker }));

const mockRunJobsWorker = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../workers/jobs.worker', () => ({ run: mockRunJobsWorker }));

jest.mock('../../../infrastructure/observability/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { main } from '../../../workers';

describe('workers/index dispatcher', () => {
  const originalEnv = process.env.WORKER_TYPE;

  beforeEach(() => {
    mockRunRelayWorker.mockClear().mockResolvedValue(undefined);
    mockRunJobsWorker.mockClear().mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env.WORKER_TYPE = originalEnv;
  });

  it('dispatches to the relay worker when WORKER_TYPE=relay', async () => {
    process.env.WORKER_TYPE = 'relay';

    await main();

    expect(mockRunRelayWorker).toHaveBeenCalledTimes(1);
    expect(mockRunJobsWorker).not.toHaveBeenCalled();
  });

  it('dispatches to the jobs worker when WORKER_TYPE=jobs', async () => {
    process.env.WORKER_TYPE = 'jobs';

    await main();

    expect(mockRunJobsWorker).toHaveBeenCalledTimes(1);
    expect(mockRunRelayWorker).not.toHaveBeenCalled();
  });

  it('throws for an unknown or missing WORKER_TYPE', async () => {
    delete process.env.WORKER_TYPE;

    await expect(main()).rejects.toThrow(/WORKER_TYPE/);

    process.env.WORKER_TYPE = 'bogus';
    await expect(main()).rejects.toThrow(/WORKER_TYPE/);
  });

  // Phase 8 Batch 3 deliberately ships no back-compat aliases: a container left on a
  // pre-Phase-8 WORKER_TYPE must fail at boot rather than start and quietly do nothing.
  it.each(['outbox', 'email', 'fulfillment'])(
    'throws for the retired WORKER_TYPE=%s, naming the valid set',
    async (retired) => {
      process.env.WORKER_TYPE = retired;

      await expect(main()).rejects.toThrow(/relay, jobs/);
      expect(mockRunRelayWorker).not.toHaveBeenCalled();
      expect(mockRunJobsWorker).not.toHaveBeenCalled();
    },
  );
});
