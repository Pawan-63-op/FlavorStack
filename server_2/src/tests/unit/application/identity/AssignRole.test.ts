import { AssignRole } from '../../../../application/identity/use-cases/AssignRole';
import { AssignRoleDto } from '../../../../application/identity/dtos/AssignRoleDto';
import {
  InMemoryUserRepository,
  InMemoryOutboxStore,
  InMemoryUnitOfWork,
} from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { Admin } from '../../../../domain/identity/entities/Admin';
import { USER_ROLE } from '../../../../domain/identity/enums/user-role.enum';
import { PERMISSION_RESOURCE } from '../../../../domain/identity/enums/permission-resource.enum';
import { PERMISSION_ACTION } from '../../../../domain/identity/enums/permission-action.enum';
import { Permission } from '../../../../domain/identity/value-objects/Permission.vo';
import { NotFoundError } from '../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';

const ADMIN_INPUT = {
  name: 'Admin User',
  email: 'admin@example.com',
  phone: '+919876543212',
  passwordHash: 'hashedpassword123',
  department: 'Operations',
};

function makeSuperAdmin(): Admin {
  const admin = Admin.createSuperAdmin(ADMIN_INPUT);
  admin.pullDomainEvents();
  return admin;
}

function makeAdminWithUserUpdate(): Admin {
  const permission = Permission.create({
    resource: PERMISSION_RESOURCE.USER,
    action: PERMISSION_ACTION.UPDATE,
  }).getValue();
  const admin = Admin.create({ ...ADMIN_INPUT, email: 'admin2@example.com', permissions: [permission] });
  admin.pullDomainEvents();
  return admin;
}

function makeAdminWithoutPermissions(): Admin {
  const admin = Admin.create({ ...ADMIN_INPUT, email: 'admin3@example.com' });
  admin.pullDomainEvents();
  return admin;
}

function makeCustomer(): Customer {
  const customer = Customer.create({
    name: 'Test User',
    email: 'user@example.com',
    phone: '+919876543210',
    passwordHash: 'hashed:Password1!',
    referralCode: 'REF00001',
  });
  customer.pullDomainEvents();
  return customer;
}

describe('AssignRole use-case', () => {
  let userRepo: InMemoryUserRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let outboxStore: InMemoryOutboxStore;
  let eventBus: EventBusSpy;
  let useCase: AssignRole;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    unitOfWork = new InMemoryUnitOfWork();
    outboxStore = new InMemoryOutboxStore();
    eventBus = createEventBusSpy();
    useCase = new AssignRole(userRepo, unitOfWork, outboxStore, eventBus);
  });

  describe('success', () => {
    it('super admin assigns a new role to a target user', async () => {
      const superAdmin = makeSuperAdmin();
      const target = makeCustomer();
      await userRepo.save(superAdmin);
      await userRepo.save(target);

      const dto: AssignRoleDto = {
        actorId: superAdmin._id,
        targetUserId: target._id,
        role: USER_ROLE.DRIVER,
      };
      const result = await useCase.execute(dto);

      expect(result.isSuccess).toBe(true);
      const updated = await userRepo.findById(target._id);
      expect(updated!.role).toBe(USER_ROLE.DRIVER);
    });

    it('appends RoleAssigned to the outbox with the target as aggregate and publishes it post-commit', async () => {
      const admin = makeAdminWithUserUpdate();
      const target = makeCustomer();
      await userRepo.save(admin);
      await userRepo.save(target);

      await useCase.execute({
        actorId: admin._id,
        targetUserId: target._id,
        role: USER_ROLE.DRIVER,
      });

      expect(outboxStore.appended).toHaveLength(1);
      expect(outboxStore.appended[0].eventName).toBe('RoleAssigned');
      expect(outboxStore.appended[0].aggregateId).toBe(target._id);

      expect(eventBus.publishedEvents).toHaveLength(1);
      expect(eventBus.publishedEvents[0].eventName).toBe('RoleAssigned');
    });

    it('allows a super admin to assign the admin role', async () => {
      const superAdmin = makeSuperAdmin();
      const target = makeCustomer();
      await userRepo.save(superAdmin);
      await userRepo.save(target);

      const result = await useCase.execute({
        actorId: superAdmin._id,
        targetUserId: target._id,
        role: USER_ROLE.ADMIN,
      });

      expect(result.isSuccess).toBe(true);
      const updated = await userRepo.findById(target._id);
      expect(updated!.role).toBe(USER_ROLE.ADMIN);
    });
  });

  describe('failure paths', () => {
    it('fails with NotFoundError when actor does not exist', async () => {
      const target = makeCustomer();
      await userRepo.save(target);

      const result = await useCase.execute({
        actorId: 'does-not-exist',
        targetUserId: target._id,
        role: USER_ROLE.DRIVER,
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('fails with ForbiddenError when actor is not an admin', async () => {
      const actor = makeCustomer();
      const target = makeCustomer();
      target.email = 'other@example.com';
      await userRepo.save(actor);
      await userRepo.save(target);

      const result = await useCase.execute({
        actorId: actor._id,
        targetUserId: target._id,
        role: USER_ROLE.DRIVER,
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
        role: USER_ROLE.DRIVER,
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('fails with ForbiddenError when a regular admin assigns the admin role', async () => {
      const admin = makeAdminWithUserUpdate();
      const target = makeCustomer();
      await userRepo.save(admin);
      await userRepo.save(target);

      const result = await useCase.execute({
        actorId: admin._id,
        targetUserId: target._id,
        role: USER_ROLE.ADMIN,
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ForbiddenError);

      const updated = await userRepo.findById(target._id);
      expect(updated!.role).toBe(USER_ROLE.CUSTOMER);
      expect(outboxStore.appended).toHaveLength(0);
      expect(eventBus.publishedEvents).toHaveLength(0);
    });

    it('fails with ForbiddenError when admin lacks USER:UPDATE permission', async () => {
      const admin = makeAdminWithoutPermissions();
      const target = makeCustomer();
      await userRepo.save(admin);
      await userRepo.save(target);

      const result = await useCase.execute({
        actorId: admin._id,
        targetUserId: target._id,
        role: USER_ROLE.DRIVER,
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ForbiddenError);
    });
  });
});
