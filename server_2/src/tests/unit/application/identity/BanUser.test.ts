import { BanUser } from '../../../../application/identity/use-cases/BanUser';
import { BanUserDto } from '../../../../application/identity/dtos/BanUserDto';
import {
  InMemoryUserRepository,
  InMemoryOutboxStore,
  InMemoryUnitOfWork,
  InMemorySessionStore,
} from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { Admin } from '../../../../domain/identity/entities/Admin';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';

const ADMIN_INPUT = {
  name: 'Admin User',
  email: 'admin@example.com',
  phone: '+919876543212',
  passwordHash: 'hashedpassword123',
  department: 'Operations',
};

function makeSuperAdmin(email = 'admin@example.com'): Admin {
  const admin = Admin.createSuperAdmin({ ...ADMIN_INPUT, email });
  admin.pullDomainEvents();
  return admin;
}

function makeAdmin(email = 'admin2@example.com'): Admin {
  const admin = Admin.create({ ...ADMIN_INPUT, email });
  admin.pullDomainEvents();
  return admin;
}

function makeCustomer(email = 'user@example.com'): Customer {
  const customer = Customer.create({
    name: 'Test User',
    email,
    phone: '+919876543210',
    passwordHash: 'hashed:Password1!',
    referralCode: 'REF00001',
  });
  customer.pullDomainEvents();
  return customer;
}

describe('BanUser use-case', () => {
  let userRepo: InMemoryUserRepository;
  let sessionStore: InMemorySessionStore;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let eventBus: EventBusSpy;
  let useCase: BanUser;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    sessionStore = new InMemorySessionStore();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    eventBus = createEventBusSpy();
    useCase = new BanUser(userRepo, sessionStore, unitOfWork, outboxStore, eventBus);
  });

  describe('success', () => {
    it('bans a target user, revokes sessions, and bumps tokenVersion', async () => {
      const admin = makeSuperAdmin();
      const target = makeCustomer();
      await userRepo.save(admin);
      await userRepo.save(target);
      await sessionStore.persist({
        userId: target._id,
        sessionId: 'session-1',
        refreshTokenHash: 'hash',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000),
      });
      const initialTokenVersion = target.tokenVersion;

      const dto: BanUserDto = {
        actorId: admin._id,
        targetUserId: target._id,
        reason: 'fraud',
      };
      const result = await useCase.execute(dto);

      expect(result.isSuccess).toBe(true);
      const updated = await userRepo.findById(target._id);
      expect(updated!.isBanned).toBe(true);
      expect(updated!.banReason).toBe('fraud');
      expect(updated!.isActive).toBe(false);
      expect(updated!.tokenVersion).toBe(initialTokenVersion + 1);

      const sessions = await sessionStore.list(target._id);
      expect(sessions).toHaveLength(0);
    });

    it('appends UserBanned to the outbox and publishes it post-commit', async () => {
      const admin = makeSuperAdmin();
      const target = makeCustomer();
      await userRepo.save(admin);
      await userRepo.save(target);

      await useCase.execute({ actorId: admin._id, targetUserId: target._id, reason: 'fraud' });

      expect(outboxStore.appended).toHaveLength(1);
      expect(outboxStore.appended[0].eventName).toBe('UserBanned');
      expect(outboxStore.appended[0].aggregateId).toBe(target._id);

      expect(eventBus.publishedEvents).toHaveLength(1);
      expect(eventBus.publishedEvents[0].eventName).toBe('UserBanned');
    });

    it('allows a super admin to ban another admin', async () => {
      const superAdmin = makeSuperAdmin();
      const targetAdmin = makeAdmin();
      await userRepo.save(superAdmin);
      await userRepo.save(targetAdmin);

      const result = await useCase.execute({
        actorId: superAdmin._id,
        targetUserId: targetAdmin._id,
        reason: 'abuse',
      });

      expect(result.isSuccess).toBe(true);
      const updated = await userRepo.findById(targetAdmin._id);
      expect(updated!.isBanned).toBe(true);
    });
  });

  describe('failure paths', () => {
    it('fails with NotFoundError when actor does not exist', async () => {
      const target = makeCustomer();
      await userRepo.save(target);

      const result = await useCase.execute({
        actorId: 'does-not-exist',
        targetUserId: target._id,
        reason: 'fraud',
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('fails with ForbiddenError when actor is not an admin', async () => {
      const actor = makeCustomer('actor@example.com');
      const target = makeCustomer('target@example.com');
      await userRepo.save(actor);
      await userRepo.save(target);

      const result = await useCase.execute({
        actorId: actor._id,
        targetUserId: target._id,
        reason: 'fraud',
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ForbiddenError);
    });

    it('fails with NotFoundError when target does not exist', async () => {
      const admin = makeSuperAdmin();
      await userRepo.save(admin);

      const result = await useCase.execute({
        actorId: admin._id,
        targetUserId: 'does-not-exist',
        reason: 'fraud',
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('fails with ForbiddenError when a regular admin bans another admin', async () => {
      const admin = makeAdmin('admin-actor@example.com');
      const targetAdmin = makeAdmin('admin-target@example.com');
      await userRepo.save(admin);
      await userRepo.save(targetAdmin);

      const result = await useCase.execute({
        actorId: admin._id,
        targetUserId: targetAdmin._id,
        reason: 'abuse',
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ForbiddenError);

      const updated = await userRepo.findById(targetAdmin._id);
      expect(updated!.isBanned).toBeFalsy();
      expect(outboxStore.appended).toHaveLength(0);
      expect(eventBus.publishedEvents).toHaveLength(0);
    });
  });
});
