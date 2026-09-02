import { randomUUID, generateKeyPairSync } from 'crypto';
import mongoose from 'mongoose';

import { bootstrap, shutdown, AppContainer } from '../../../container';
import { connectDB } from '../../../infrastructure/database/connection';
import { getTestMongoUri } from '../../setup';
import { startRedisContainer, StartedTestRedis } from '../redis/redis-container';
import {
  OutboxEventModel,
  OUTBOX_STATUS,
} from '../../../infrastructure/database/models/OutboxEventModel';
import { UserModel } from '../../../infrastructure/database/models/UserModel';
import { DomainEvent } from '../../../domain/shared/DomainEvent';
import { buildCustomer } from './identity-fixtures';

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
import { OutboxProcessor } from '../../../infrastructure/outbox/OutboxProcessor';

jest.setTimeout(180000);

const ORIGINAL_ENV = { ...process.env };

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function makeEvent(aggregateId: string, eventName = 'IntegrationTestEvent'): DomainEvent {
  return { eventId: randomUUID(), occurredOn: new Date(), eventName, aggregateId };
}

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs = 100,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`waitFor: condition not met within ${timeoutMs}ms`);
}

describe('Identity container bootstrap (Phase 9, Batch 5)', () => {
  let app: AppContainer;
  let redis: StartedTestRedis;

  beforeAll(async () => {
    redis = await startRedisContainer();

    process.env.MONGO_URI = getTestMongoUri();
    process.env.REDIS_HOST = redis.config.host;
    process.env.REDIS_PORT = String(redis.config.port);
    process.env.JWT_PRIVATE_KEY = privateKey;
    process.env.JWT_PUBLIC_KEY = publicKey;
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.OUTBOX_POLL_INTERVAL_MS = '500';

    app = await bootstrap();
  });

  afterAll(async () => {
    await redis.container.stop();
    process.env = { ...ORIGINAL_ENV };
  });

  it('resolves a fully-populated AppContainer with all 20 use-cases as the correct instances', () => {
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
    expect(Object.values(app.useCases).every((uc) => uc !== undefined)).toBe(true);

    expect(app.outboxProcessor).toBeInstanceOf(OutboxProcessor);
    expect(app.identity).toBeDefined();
    expect(app.auth).toBeDefined();
    expect(app.event).toBeDefined();

    expect(app.connection.readyState).toBe(mongoose.ConnectionStates.connected);
    expect(app.redisClient.isReady()).toBe(true);
  });

  describe('OutboxProcessor (started by bootstrap)', () => {
    afterEach(async () => {
      await OutboxEventModel.deleteMany({});
    });

    it('drains a PENDING row to PROCESSED via the live poller', async () => {
      const eventId = randomUUID();
      const aggregateId = randomUUID();
      const doc = await OutboxEventModel.create({
        eventId,
        eventName: 'IntegrationTestEvent',
        aggregateId,
        aggregateType: 'user',
        payload: { eventId, eventName: 'IntegrationTestEvent', aggregateId, occurredOn: new Date() },
        status: OUTBOX_STATUS.PENDING,
        retryCount: 0,
        createdAt: new Date(),
        processedAt: null,
        nextAttemptAt: new Date(),
        lastError: null,
      });

      await waitFor(async () => {
        const row = await OutboxEventModel.findById(doc._id).lean();
        return row?.status === OUTBOX_STATUS.PROCESSED;
      }, 10000);

      const updated = await OutboxEventModel.findById(doc._id).lean();
      expect(updated!.status).toBe(OUTBOX_STATUS.PROCESSED);
      expect(updated!.processedAt).toBeInstanceOf(Date);
    });
  });

  describe('shared TransactionContext (Batch 2 invariant)', () => {
    afterEach(async () => {
      await UserModel.deleteMany({});
      await OutboxEventModel.deleteMany({});
    });

    it('commits userRepository.save + outboxStore.append atomically inside unitOfWork.runInTransaction', async () => {
      const customer = buildCustomer();
      const event = makeEvent(customer._id);

      await app.identity.unitOfWork.runInTransaction(async (ctx) => {
        await app.identity.userRepository.save(customer);
        await app.commerce.outboxStore.append([event], ctx);
      });

      const savedUser = await UserModel.findById(customer._id).lean();
      const rows = await OutboxEventModel.find({ aggregateId: customer._id }).lean();
      expect(savedUser).not.toBeNull();
      expect(rows).toHaveLength(1);
      expect(rows[0].eventId).toBe(event.eventId);
    });

    it('rolls back both the user save and the outbox append when the work throws', async () => {
      const customer = buildCustomer();
      const event = makeEvent(customer._id);

      await expect(
        app.identity.unitOfWork.runInTransaction(async (ctx) => {
          await app.identity.userRepository.save(customer);
          await app.commerce.outboxStore.append([event], ctx);
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      expect(await UserModel.findById(customer._id).lean()).toBeNull();
      expect(await OutboxEventModel.countDocuments({ aggregateId: customer._id })).toBe(0);
    });
  });

  describe('shutdown', () => {
    it('stops the outbox poller, closes Redis, and disconnects Mongo without throwing', async () => {
      await shutdown(app);

      expect(app.redisClient.isReady()).toBe(false);
      expect(app.connection.readyState).toBe(mongoose.ConnectionStates.disconnected);

      await connectDB(getTestMongoUri());
    });
  });
});
