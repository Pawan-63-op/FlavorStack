import { generateKeyPairSync } from 'crypto';

jest.mock('../../../infrastructure/database/connection', () => ({
  connectDB: jest.fn(),
  disconnectDB: jest.fn(),
}));

const mockRedisInstance = {
  connect: jest.fn(),
  shutdown: jest.fn(),
  getClient: jest.fn(() => ({})),
  isReady: jest.fn(() => true),
};
jest.mock('../../../infrastructure/redis/client', () => ({
  RedisClient: jest.fn(() => mockRedisInstance),
}));

jest.mock('../../../infrastructure/database/seeds', () => ({
  runSeeds: jest.fn().mockResolvedValue({ notificationTemplatesCreated: 0 }),
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(function (this: { add: jest.Mock; close: jest.Mock }) {
    this.add = jest.fn().mockResolvedValue(undefined);
    this.close = jest.fn().mockResolvedValue(undefined);
  }),
}));

import { Queue } from 'bullmq';
import { bootstrap, bootstrapWorker, shutdown, AppContainer } from '../../../container';
import { QUEUE } from '../../../config/bullmq';
import { connectDB, disconnectDB } from '../../../infrastructure/database/connection';
import { RedisClient } from '../../../infrastructure/redis/client';
import { runSeeds } from '../../../infrastructure/database/seeds';

const mockConnectDB = connectDB as jest.MockedFunction<typeof connectDB>;
const mockDisconnectDB = disconnectDB as jest.MockedFunction<typeof disconnectDB>;

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.JWT_PRIVATE_KEY = privateKey;
  process.env.JWT_PUBLIC_KEY = publicKey;
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.BCRYPT_ROUNDS = '4';
  process.env.OUTBOX_POLL_INTERVAL_MS = '999999';
  process.env.MONGO_URI = 'mongodb://localhost:27017/test?replicaSet=rs0';

  (RedisClient as unknown as jest.Mock).mockImplementation(() => mockRedisInstance);
  (Queue as unknown as jest.Mock).mockClear();
  (Queue as unknown as jest.Mock).mockImplementation(function (this: { add: jest.Mock; close: jest.Mock }) {
    this.add = jest.fn().mockResolvedValue(undefined);
    this.close = jest.fn().mockResolvedValue(undefined);
  });
  (runSeeds as jest.Mock).mockClear();
  (runSeeds as jest.Mock).mockResolvedValue({ notificationTemplatesCreated: 0 });
  mockConnectDB.mockResolvedValue({} as Awaited<ReturnType<typeof connectDB>>);
  mockDisconnectDB.mockResolvedValue(undefined);
  mockRedisInstance.connect.mockResolvedValue(undefined);
  mockRedisInstance.shutdown.mockResolvedValue(undefined);
  mockRedisInstance.getClient.mockReturnValue({});
  mockRedisInstance.isReady.mockReturnValue(true);
});

afterEach(() => {
  process.env = { ...originalEnv };
});

function queueNames(): string[] {
  return (Queue as unknown as jest.Mock).mock.calls.map((call) => call[0] as string);
}

describe.each(['relay', 'jobs'] as const)('bootstrapWorker(%s)', (profile) => {
  it('does not seed — the api process owns seeding and is always present', async () => {
    const app = await bootstrapWorker(profile);

    try {
      expect(runSeeds).not.toHaveBeenCalled();
    } finally {
      await shutdown(app);
    }
  });

  it('opens the fulfillment queue only — no EmailQueue in a worker', async () => {
    const app = await bootstrapWorker(profile);

    try {
      expect(queueNames()).toEqual([QUEUE.fulfillment]);
    } finally {
      await shutdown(app);
    }
  });

  it('returns no api-only slices (useCases, auth, commerce, emailQueue)', async () => {
    const app = await bootstrapWorker(profile);

    try {
      expect('useCases' in app).toBe(false);
      expect('auth' in app).toBe(false);
      expect('commerce' in app).toBe(false);
      expect('emailQueue' in app).toBe(false);
    } finally {
      await shutdown(app);
    }
  });

  it('does not start the outbox poller — the relay entrypoint starts it explicitly', async () => {
    const app = await bootstrapWorker(profile);

    try {
      expect(app.outboxProcessor).toBeDefined();
    } finally {
      await shutdown(app);
    }
  });

  it('builds without the JWT key pair — workers never mint or verify tokens', async () => {
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;

    const app = await bootstrapWorker(profile);
    await shutdown(app);
  });

  it('throws before connecting to Mongo when MONGO_URI is missing', async () => {
    delete process.env.MONGO_URI;

    await expect(bootstrapWorker(profile)).rejects.toThrow(/MONGO_URI/);
    expect(mockConnectDB).not.toHaveBeenCalled();
  });

  it('shuts down cleanly even though it owns no email queue', async () => {
    const app = await bootstrapWorker(profile);

    await shutdown(app);

    expect(mockRedisInstance.shutdown).toHaveBeenCalledTimes(1);
    expect(mockDisconnectDB).toHaveBeenCalledTimes(1);
  });
});

describe('bootstrap (api profile)', () => {
  it('seeds, opens the email queue, and returns the identity use cases', async () => {
    const app: AppContainer = await bootstrap({ startOutboxProcessor: false });

    try {
      expect(runSeeds).toHaveBeenCalledTimes(1);
      expect(queueNames()).toEqual(expect.arrayContaining([QUEUE.email, QUEUE.fulfillment]));
      expect(app.useCases.login).toBeDefined();
      expect(app.emailQueue).toBeDefined();
    } finally {
      await shutdown(app);
    }
  });
});
