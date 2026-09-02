import { GrantPermission } from '../../../../application/identity/use-cases/GrantPermission';
import { GrantPermissionDto } from '../../../../application/identity/dtos/GrantPermissionDto';
import {
  InMemoryUserRepository,
  InMemoryUnitOfWork,
} from '../../../mocks/identity.mocks';
import { createEventBusSpy, EventBusSpy } from '../../../mocks/shared.mocks';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { Admin } from '../../../../domain/identity/entities/Admin';
import { PERMISSION_RESOURCE, PermissionResource } from '../../../../domain/identity/enums/permission-resource.enum';
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

function makeAdminWithUserManage(): Admin {
  const permission = Permission.create({
    resource: PERMISSION_RESOURCE.USER,
    action: PERMISSION_ACTION.MANAGE,
  }).getValue();
  const admin = Admin.create({ ...ADMIN_INPUT, email: 'admin2@example.com', permissions: [permission] });
  admin.pullDomainEvents();
  return admin;
}

function makeAdminWithoutPermissions(email = 'admin3@example.com'): Admin {
  const admin = Admin.create({ ...ADMIN_INPUT, email });
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

describe('GrantPermission use-case', () => {
  let userRepo: InMemoryUserRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let eventBus: EventBusSpy;
  let useCase: GrantPermission;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    unitOfWork = new InMemoryUnitOfWork();
    eventBus = createEventBusSpy();
    useCase = new GrantPermission(userRepo, unitOfWork, eventBus);
  });

  describe('success', () => {
    it('super admin grants a new permission to a target admin', async () => {
      const superAdmin = makeSuperAdmin();
      const target = makeAdminWithoutPermissions();
      await userRepo.save(superAdmin);
      await userRepo.save(target);

      const dto: GrantPermissionDto = {
        actorId: superAdmin._id,
        targetAdminId: target._id,
        resource: PERMISSION_RESOURCE.MENU,
        action: PERMISSION_ACTION.UPDATE,
      };
      const result = await useCase.execute(dto);

      expect(result.isSuccess).toBe(true);
      const updated = (await userRepo.findById(target._id)) as Admin;
      expect(updated.hasPermission(PERMISSION_RESOURCE.MENU, PERMISSION_ACTION.UPDATE)).toBe(true);

      // Phase 6: this state change raises no domain event — it had no subscriber.
      expect(eventBus.publishedEvents).toHaveLength(0);
      expect(eventBus.publishedEvents).toHaveLength(0);
    });

    it('admin with USER:MANAGE permission grants a permission to another admin', async () => {
      const admin = makeAdminWithUserManage();
      const target = makeAdminWithoutPermissions('admin4@example.com');
      await userRepo.save(admin);
      await userRepo.save(target);

      const result = await useCase.execute({
        actorId: admin._id,
        targetAdminId: target._id,
        resource: PERMISSION_RESOURCE.ORDER,
        action: PERMISSION_ACTION.READ,
      });

      expect(result.isSuccess).toBe(true);
      const updated = (await userRepo.findById(target._id)) as Admin;
      expect(updated.hasPermission(PERMISSION_RESOURCE.ORDER, PERMISSION_ACTION.READ)).toBe(true);
    });

    it('is idempotent — granting an already-held permission raises no event', async () => {
      const superAdmin = makeSuperAdmin();
      const permission = Permission.create({
        resource: PERMISSION_RESOURCE.MENU,
        action: PERMISSION_ACTION.UPDATE,
      }).getValue();
      const target = Admin.create({ ...ADMIN_INPUT, email: 'admin5@example.com', permissions: [permission] });
      target.pullDomainEvents();
      await userRepo.save(superAdmin);
      await userRepo.save(target);

      const result = await useCase.execute({
        actorId: superAdmin._id,
        targetAdminId: target._id,
        resource: PERMISSION_RESOURCE.MENU,
        action: PERMISSION_ACTION.UPDATE,
      });

      expect(result.isSuccess).toBe(true);
      const updated = (await userRepo.findById(target._id)) as Admin;
      expect(updated.permissions).toHaveLength(1);
      expect(eventBus.publishedEvents).toHaveLength(0);
      expect(eventBus.publishedEvents).toHaveLength(0);
    });
  });

  describe('failure paths', () => {
    it('fails with NotFoundError when actor does not exist', async () => {
      const target = makeAdminWithoutPermissions();
      await userRepo.save(target);

      const result = await useCase.execute({
        actorId: 'does-not-exist',
        targetAdminId: target._id,
        resource: PERMISSION_RESOURCE.MENU,
        action: PERMISSION_ACTION.UPDATE,
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('fails with ForbiddenError when actor is not an admin', async () => {
      const actor = makeCustomer();
      const target = makeAdminWithoutPermissions();
      await userRepo.save(actor);
      await userRepo.save(target);

      const result = await useCase.execute({
        actorId: actor._id,
        targetAdminId: target._id,
        resource: PERMISSION_RESOURCE.MENU,
        action: PERMISSION_ACTION.UPDATE,
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ForbiddenError);
    });

    it('fails with NotFoundError when target admin does not exist', async () => {
      const superAdmin = makeSuperAdmin();
      await userRepo.save(superAdmin);

      const result = await useCase.execute({
        actorId: superAdmin._id,
        targetAdminId: 'does-not-exist',
        resource: PERMISSION_RESOURCE.MENU,
        action: PERMISSION_ACTION.UPDATE,
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('fails with NotFoundError when target is not an admin', async () => {
      const superAdmin = makeSuperAdmin();
      const target = makeCustomer();
      await userRepo.save(superAdmin);
      await userRepo.save(target);

      const result = await useCase.execute({
        actorId: superAdmin._id,
        targetAdminId: target._id,
        resource: PERMISSION_RESOURCE.MENU,
        action: PERMISSION_ACTION.UPDATE,
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(NotFoundError);
    });

    it('fails with ForbiddenError when actor lacks USER:MANAGE permission', async () => {
      const admin = makeAdminWithoutPermissions();
      const target = makeAdminWithoutPermissions('admin6@example.com');
      await userRepo.save(admin);
      await userRepo.save(target);

      const result = await useCase.execute({
        actorId: admin._id,
        targetAdminId: target._id,
        resource: PERMISSION_RESOURCE.MENU,
        action: PERMISSION_ACTION.UPDATE,
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ForbiddenError);
      expect(eventBus.publishedEvents).toHaveLength(0);
      expect(eventBus.publishedEvents).toHaveLength(0);
    });

    it('fails when the permission resource/action is invalid', async () => {
      const superAdmin = makeSuperAdmin();
      const target = makeAdminWithoutPermissions();
      await userRepo.save(superAdmin);
      await userRepo.save(target);

      const result = await useCase.execute({
        actorId: superAdmin._id,
        targetAdminId: target._id,
        resource: 'NOT_A_RESOURCE' as PermissionResource,
        action: PERMISSION_ACTION.UPDATE,
      });

      expect(result.isFailure).toBe(true);
    });
  });
});
