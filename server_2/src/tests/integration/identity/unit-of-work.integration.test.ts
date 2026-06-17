import { randomUUID } from 'crypto';
import type { ClientSession } from 'mongoose';
import { getConnection } from '../../../infrastructure/database/connection';
import { TransactionContext } from '../../../infrastructure/database/TransactionContext';
import { MongoUnitOfWork } from '../../../infrastructure/database/MongoUnitOfWork';
import { UserModel, UserDocument } from '../../../infrastructure/database/models/UserModel';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';
import { AUTH_PROVIDER } from '../../../domain/identity/enums/auth-provider.enum';

function makeUserDoc(): UserDocument {
  const now = new Date();
  return {
    _id: randomUUID(),
    name: 'UoW User',
    email: `uow-${randomUUID()}@example.com`,
    phone: `+1${Math.floor(1_000_000_000 + Math.random() * 8_000_000_000)}`,
    avatarUrl: '',
    role: USER_ROLE.CUSTOMER,
    passwordHash: 'hashed-password',
    authProvider: AUTH_PROVIDER.LOCAL,
    providerId: '',
    isEmailVerified: false,
    passwordChangedAt: null,
    tokenVersion: 0,
    loginAttempts: 0,
    lockUntil: null,
    lastLoginAt: null,
    lastLoginIp: null,
    isBanned: false,
    banReason: null,
    isActive: true,
    deletedAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

describe('MongoUnitOfWork', () => {
  let txContext: TransactionContext;
  let uow: MongoUnitOfWork;

  beforeEach(() => {
    txContext = new TransactionContext();
    uow = new MongoUnitOfWork(getConnection(), txContext);
  });

  afterEach(async () => {
    await UserModel.deleteMany({});
  });

  describe('commit path', () => {
    it('persists a write made within the transaction', async () => {
      const doc = makeUserDoc();

      await uow.runInTransaction(async () => {
        await UserModel.create([doc], { session: txContext.getSession() });
      });

      const found = await UserModel.findById(doc._id).lean();
      expect(found).not.toBeNull();
      expect(found?.email).toBe(doc.email);
    });

    it('returns the value produced by the work callback', async () => {
      const result = await uow.runInTransaction(async () => 'done');
      expect(result).toBe('done');
    });
  });

  describe('rollback path', () => {
    it('rolls back all writes when the work callback throws', async () => {
      const doc = makeUserDoc();

      await expect(
        uow.runInTransaction(async () => {
          await UserModel.create([doc], { session: txContext.getSession() });
          throw new Error('work failed');
        }),
      ).rejects.toThrow('work failed');

      const found = await UserModel.findById(doc._id).lean();
      expect(found).toBeNull();
    });
  });

  describe('session propagation', () => {
    it('passes the ClientSession as the ctx argument to work', async () => {
      let ctxArg: unknown;
      await uow.runInTransaction(async (ctx) => {
        ctxArg = ctx;
      });
      expect(ctxArg).toBeDefined();
      expect((ctxArg as ClientSession).id).toBeDefined();
    });

    it('exposes the SAME session via TransactionContext.getSession() inside work', async () => {
      let ctxArg: unknown;
      let fromContext: ClientSession | undefined;
      await uow.runInTransaction(async (ctx) => {
        ctxArg = ctx;
        fromContext = txContext.getSession();
      });
      expect(fromContext).toBe(ctxArg);
    });

    it('clears the session after the transaction completes', async () => {
      await uow.runInTransaction(async () => undefined);
      expect(txContext.getSession()).toBeUndefined();
    });

    it('clears the session after the transaction rolls back', async () => {
      await expect(
        uow.runInTransaction(async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(txContext.getSession()).toBeUndefined();
    });
  });
});
