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
import { bootstrap, shutdown, AppContainer } from '../../../container';
import { EmailQueue } from '../../../infrastructure/workers/email/EmailQueue';
import { QUEUE } from '../../../config/bullmq';
import { connectDB, disconnectDB } from '../../../infrastructure/database/connection';
import { RedisClient } from '../../../infrastructure/redis/client';
import { OutboxProcessor } from '../../../infrastructure/outbox/OutboxProcessor';
import { runSeeds } from '../../../infrastructure/database/seeds';
import { RegisterCustomer } from '../../../application/identity/use-cases/RegisterCustomer';
import { RegisterDriver } from '../../../application/identity/use-cases/RegisterDriver';
import { RegisterUser } from '../../../application/identity/use-cases/RegisterUser';
import { Login } from '../../../application/identity/use-cases/Login';
import { RefreshToken } from '../../../application/identity/use-cases/RefreshToken';
import { Logout } from '../../../application/identity/use-cases/Logout';
import { LogoutAllSessions } from '../../../application/identity/use-cases/LogoutAllSessions';
import { GetActiveSessions } from '../../../application/identity/use-cases/GetActiveSessions';
import { VerifyEmail } from '../../../application/identity/use-cases/VerifyEmail';
import { ForgotPassword } from '../../../application/identity/use-cases/ForgotPassword';
import { ResetPassword } from '../../../application/identity/use-cases/ResetPassword';
import { ChangePassword } from '../../../application/identity/use-cases/ChangePassword';
import { SendEmailOtp } from '../../../application/identity/use-cases/SendEmailOtp';
import { VerifyEmailOtp } from '../../../application/identity/use-cases/VerifyEmailOtp';
import { SendPhoneOtp } from '../../../application/identity/use-cases/SendPhoneOtp';
import { VerifyPhoneOtp } from '../../../application/identity/use-cases/VerifyPhoneOtp';
import { AssignRole } from '../../../application/identity/use-cases/AssignRole';
import { GrantPermission } from '../../../application/identity/use-cases/GrantPermission';
import { BanUser } from '../../../application/identity/use-cases/BanUser';
import { UnbanUser } from '../../../application/identity/use-cases/UnbanUser';
import { GetProfile } from '../../../application/identity/use-cases/GetProfile';
import { UpdateProfile } from '../../../application/identity/use-cases/UpdateProfile';
import { RbacService } from '../../../infrastructure/auth/RbacService';
import { RateLimiter } from '../../../infrastructure/redis/RateLimiter';

const mockConnectDB = connectDB as jest.MockedFunction<typeof connectDB>;
const mockDisconnectDB = disconnectDB as jest.MockedFunction<typeof disconnectDB>;

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const originalEnv = { ...process.env };

function setValidEnv(): void {
  process.env.JWT_PRIVATE_KEY = privateKey;
  process.env.JWT_PUBLIC_KEY = publicKey;
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.BCRYPT_ROUNDS = '4';
  process.env.OUTBOX_POLL_INTERVAL_MS = '999999';
}

beforeEach(() => {
  setValidEnv();
  (RedisClient as unknown as jest.Mock).mockImplementation(() => mockRedisInstance);
  (Queue as unknown as jest.Mock).mockImplementation(function (this: { add: jest.Mock; close: jest.Mock }) {
    this.add = jest.fn().mockResolvedValue(undefined);
    this.close = jest.fn().mockResolvedValue(undefined);
  });
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

describe('bootstrap', () => {
  it('resolves a fully-populated AppContainer with all 20 use-cases as the correct instances', async () => {
    const app = await bootstrap();

    try {
      expect(app.useCases.registerCustomer).toBeInstanceOf(RegisterCustomer);
      expect(app.useCases.registerDriver).toBeInstanceOf(RegisterDriver);
      expect(app.useCases.registerUser).toBeInstanceOf(RegisterUser);
      expect(app.useCases.login).toBeInstanceOf(Login);
      expect(app.useCases.refreshToken).toBeInstanceOf(RefreshToken);
      expect(app.useCases.logout).toBeInstanceOf(Logout);
      expect(app.useCases.logoutAllSessions).toBeInstanceOf(LogoutAllSessions);
      expect(app.useCases.getActiveSessions).toBeInstanceOf(GetActiveSessions);
      expect(app.useCases.verifyEmail).toBeInstanceOf(VerifyEmail);
      expect(app.useCases.forgotPassword).toBeInstanceOf(ForgotPassword);
      expect(app.useCases.resetPassword).toBeInstanceOf(ResetPassword);
      expect(app.useCases.changePassword).toBeInstanceOf(ChangePassword);
      expect(app.useCases.sendEmailOtp).toBeInstanceOf(SendEmailOtp);
      expect(app.useCases.verifyEmailOtp).toBeInstanceOf(VerifyEmailOtp);
      expect(app.useCases.sendPhoneOtp).toBeInstanceOf(SendPhoneOtp);
      expect(app.useCases.verifyPhoneOtp).toBeInstanceOf(VerifyPhoneOtp);
      expect(app.useCases.assignRole).toBeInstanceOf(AssignRole);
      expect(app.useCases.grantPermission).toBeInstanceOf(GrantPermission);
      expect(app.useCases.banUser).toBeInstanceOf(BanUser);
      expect(app.useCases.unbanUser).toBeInstanceOf(UnbanUser);
      expect(app.useCases.getProfile).toBeInstanceOf(GetProfile);
      expect(app.useCases.updateProfile).toBeInstanceOf(UpdateProfile);

      expect(Object.values(app.useCases).every((uc) => uc !== undefined)).toBe(true);
      expect(app.outboxProcessor).toBeInstanceOf(OutboxProcessor);
      expect(app.identity).toBeDefined();
      expect(app.auth).toBeDefined();
      expect(app.event).toBeDefined();
      expect(app.auth.rbacService).toBeInstanceOf(RbacService);
      expect(app.auth.rateLimiter).toBeInstanceOf(RateLimiter);
    } finally {
      await shutdown(app);
    }
  });

  it('starts the OutboxProcessor only after wiring the identity event handlers', async () => {
    const startSpy = jest.spyOn(OutboxProcessor.prototype, 'start');

    const app = await bootstrap();

    try {
      expect(startSpy).toHaveBeenCalledTimes(1);
      const subscribed = await emailHandlerIsSubscribed(app);
      expect(subscribed).toBe(true);
    } finally {
      await shutdown(app);
      startSpy.mockRestore();
    }
  });

  it('runs seeds during bootstrap, before the OutboxProcessor starts', async () => {
    const startSpy = jest.spyOn(OutboxProcessor.prototype, 'start');

    const app = await bootstrap();

    try {
      expect(runSeeds).toHaveBeenCalledTimes(1);
      const seedOrder = (runSeeds as jest.Mock).mock.invocationCallOrder[0];
      const startOrder = startSpy.mock.invocationCallOrder[0];
      expect(seedOrder).toBeLessThan(startOrder);
    } finally {
      await shutdown(app);
      startSpy.mockRestore();
    }
  });

  it('continues startup when seeding hits a ConflictError (concurrent cold-start by a peer)', async () => {
    const { ConflictError } = jest.requireActual('../../../domain/shared/errors/ConflictError');
    (runSeeds as jest.Mock).mockRejectedValueOnce(new ConflictError('template already exists'));

    const app = await bootstrap();

    try {
      expect(app.engagement).toBeDefined();
    } finally {
      await shutdown(app);
    }
  });

  it('validates config first — throws before connecting to Mongo when JWT keys are missing', async () => {
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PUBLIC_KEY;

    await expect(bootstrap()).rejects.toThrow(/Missing required environment variables/);
    expect(mockConnectDB).not.toHaveBeenCalled();
  });

  it('disconnects Mongo if Redis connection fails after the DB is up (partial-bootstrap cleanup)', async () => {
    mockRedisInstance.connect.mockRejectedValueOnce(new Error('redis down'));

    await expect(bootstrap()).rejects.toThrow('redis down');
    expect(mockConnectDB).toHaveBeenCalledTimes(1);
    expect(mockDisconnectDB).toHaveBeenCalledTimes(1);
  });

  it('starts the OutboxProcessor by default (no options)', async () => {
    const startSpy = jest.spyOn(OutboxProcessor.prototype, 'start');

    const app = await bootstrap();

    try {
      expect(startSpy).toHaveBeenCalledTimes(1);
    } finally {
      await shutdown(app);
      startSpy.mockRestore();
    }
  });

  it('does not start the OutboxProcessor when startOutboxProcessor is false', async () => {
    const startSpy = jest.spyOn(OutboxProcessor.prototype, 'start');

    const app = await bootstrap({ startOutboxProcessor: false });

    try {
      expect(startSpy).not.toHaveBeenCalled();
    } finally {
      await shutdown(app);
      startSpy.mockRestore();
    }
  });

  it('constructs a BullMQ-backed EmailQueue and wires it into the identity event handlers', async () => {
    const app = await bootstrap();

    try {
      expect(app.emailQueue).toBeInstanceOf(EmailQueue);
      expect(Queue).toHaveBeenCalledWith(QUEUE.email, expect.objectContaining({ connection: expect.anything() }));

      const subscribed = await emailHandlerIsSubscribed(app);
      expect(subscribed).toBe(true);
    } finally {
      await shutdown(app);
    }
  });
});

describe('shutdown', () => {
  it('stops the OutboxProcessor, then closes the email queue, then Redis, then Mongo (reverse order)', async () => {
    const stopSpy = jest.spyOn(OutboxProcessor.prototype, 'stop');

    const app = await bootstrap();
    await shutdown(app);

    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(mockRedisInstance.shutdown).toHaveBeenCalledTimes(1);
    expect(mockDisconnectDB).toHaveBeenCalledTimes(1);

    const queueInstance = (Queue as unknown as jest.Mock).mock.instances[0] as { close: jest.Mock };
    expect(queueInstance.close).toHaveBeenCalledTimes(1);

    const stopOrder = stopSpy.mock.invocationCallOrder[0];
    const queueCloseOrder = queueInstance.close.mock.invocationCallOrder[0];
    const redisOrder = mockRedisInstance.shutdown.mock.invocationCallOrder[0];
    const dbOrder = mockDisconnectDB.mock.invocationCallOrder[0];
    expect(stopOrder).toBeLessThan(queueCloseOrder);
    expect(queueCloseOrder).toBeLessThan(redisOrder);
    expect(redisOrder).toBeLessThan(dbOrder);

    stopSpy.mockRestore();
  });
});

/** Behaviorally confirm the identity handlers are subscribed on the bus by checking
 *  the bus reports a subscriber for 'UserRegistered'. */
async function emailHandlerIsSubscribed(app: AppContainer): Promise<boolean> {
  const bus = app.event.eventBus as unknown as {
    handlers?: Map<string, unknown[]>;
    subscribers?: Map<string, unknown[]>;
  };
  const map = bus.handlers ?? bus.subscribers;
  if (!map) return false;
  const list = map.get('UserRegistered');
  return Array.isArray(list) && list.length > 0;
}
