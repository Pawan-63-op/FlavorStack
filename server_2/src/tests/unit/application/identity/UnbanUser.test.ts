import { UnbanUser } from '../../../../application/identity/use-cases/UnbanUser';
import { UnbanUserDto } from '../../../../application/identity/dtos/UnbanUserDto';
import {
  InMemoryUserRepository,
  InMemoryOutboxStore,
  InMemoryUnitOfWork,
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

function makeBannedCustomer(email = 'user@example.com'): Customer {
  const customer = Customer.create({
    name: 'Test User',
    email,
    phone: '+919876543210',
    passwordHash: 'hashed:Password1!',
    referralCode: 'REF00001',
  });
  customer.ban('fraud');
  customer.pullDomainEvents();
  return customer;
}

describe('UnbanUser use-case', () => {
  let userRepo: InMemoryUserRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let eventBus: EventBusSpy;
  let useCase: UnbanUser;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    eventBus = createEventBusSpy();
    useCase = new UnbanUser(userRepo, unitOfWork, outboxStore, eventBus);
  });

  describe('success', () => {
    it('lifts the ban on a target user', async () => {
      const admin = makeSuperAdmin();
      const target = makeBannedCustomer();
      await userRepo.save(admin);
      await userRepo.save(target);

      const dto: UnbanUserDto = {
        actorId: admin._id,
        targetUserId: target._id,
      };
      const result = await useCase.execute(dto);

      expect(result.isSuccess).toBe(true);
      const updated = await userRepo.findById(target._id);
      expect(updated!.isBanned).toBe(false);
      expect(updated!.banReason).toBeNull();
      expect(updated!.isActive).toBe(true);
    });

    it('appends UserUnbanned to the outbox and publishes it post-commit', async () => {
      const admin = makeSuperAdmin();
      const target = makeBannedCustomer();
      await userRepo.save(admin);
      await userRepo.save(target);

      await useCase.execute({ actorId: admin._id, targetUserId: target._id });

      expect(outboxStore.appended).toHaveLength(1);
      expect(outboxStore.appended[0].eventName).toBe('UserUnbanned');
      expect(outboxStore.appended[0].aggregateId).toBe(target._id);

      expect(eventBus.publishedEvents).toHaveLength(1);
      expect(eventBus.publishedEvents[0].eventName).toBe('UserUnbanned');
    });

    it('allows a super admin to unban another admin', async () => {
      const superAdmin = makeSuperAdmin();
      const targetAdmin = makeAdmin();
      targetAdmin.ban('abuse');
      targetAdmin.pullDomainEvents();
      await userRepo.save(superAdmin);
      await userRepo.save(targetAdmin);

      const result = await useCase.execute({
        actorId: superAdmin._id,
        targetUserId: targetAdmin._id,
      });

      expect(result.isSuccess).toBe(true);
      const updated = await userRepo.findById(targetAdmin._id);
      expect(updated!.isBanned).toBe(false);
    });
  });

  describe('failure paths', () => {
    it('fails with NotFoundError when actor does not exist', async () => {
      const target = makeBannedCustomer();
      await userRepo.save(target);

      const result = await useCase.execute({
        actorId: 'does-not-exist',
        targetUserId: target._id,
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('fails with ForbiddenError when actor is not an admin', async () => {
      const actor = makeBannedCustomer('actor@example.com');
      const target = makeBannedCustomer('target@example.com');
      await userRepo.save(actor);
      await userRepo.save(target);

      const result = await useCase.execute({
        actorId: actor._id,
        targetUserId: target._id,
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
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('fails with ForbiddenError when a regular admin unbans another admin', async () => {
      const admin = makeAdmin('admin-actor@example.com');
      const targetAdmin = makeAdmin('admin-target@example.com');
      targetAdmin.ban('abuse');
      targetAdmin.pullDomainEvents();
      await userRepo.save(admin);
      await userRepo.save(targetAdmin);

      const result = await useCase.execute({
        actorId: admin._id,
        targetUserId: targetAdmin._id,
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ForbiddenError);

      const updated = await userRepo.findById(targetAdmin._id);
      expect(updated!.isBanned).toBe(true);
      expect(outboxStore.appended).toHaveLength(0);
      expect(eventBus.publishedEvents).toHaveLength(0);
    });
  });
});
