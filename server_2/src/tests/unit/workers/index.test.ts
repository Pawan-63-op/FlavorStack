const mockRunOutboxWorker = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../workers/outbox.worker', () => ({ run: mockRunOutboxWorker }));

const mockRunEmailWorker = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../workers/email.worker', () => ({ run: mockRunEmailWorker }));

const mockRunNotificationWorker = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../workers/notification.worker', () => ({ run: mockRunNotificationWorker }));

jest.mock('../../../infrastructure/observability/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn() },
}));

import { main } from '../../../workers';

describe('workers/index dispatcher', () => {
  const originalEnv = process.env.WORKER_TYPE;

  beforeEach(() => {
    mockRunOutboxWorker.mockClear().mockResolvedValue(undefined);
    mockRunEmailWorker.mockClear().mockResolvedValue(undefined);
    mockRunNotificationWorker.mockClear().mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env.WORKER_TYPE = originalEnv;
  });

  it('dispatches to the outbox worker when WORKER_TYPE=outbox', async () => {
    process.env.WORKER_TYPE = 'outbox';

    await main();

    expect(mockRunOutboxWorker).toHaveBeenCalledTimes(1);
    expect(mockRunEmailWorker).not.toHaveBeenCalled();
    expect(mockRunNotificationWorker).not.toHaveBeenCalled();
  });

  it('dispatches to the email worker when WORKER_TYPE=email', async () => {
    process.env.WORKER_TYPE = 'email';

    await main();

    expect(mockRunEmailWorker).toHaveBeenCalledTimes(1);
  });

  it('dispatches to the notification worker when WORKER_TYPE=notification', async () => {
    process.env.WORKER_TYPE = 'notification';

    await main();

    expect(mockRunNotificationWorker).toHaveBeenCalledTimes(1);
  });

  it('throws for an unknown or missing WORKER_TYPE', async () => {
    delete process.env.WORKER_TYPE;

    await expect(main()).rejects.toThrow(/WORKER_TYPE/);

    process.env.WORKER_TYPE = 'bogus';
    await expect(main()).rejects.toThrow(/WORKER_TYPE/);
  });
});
