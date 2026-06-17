import { RbacService } from '../../../../infrastructure/auth/RbacService';
import { Admin } from '../../../../domain/identity/entities/Admin';
import { Customer } from '../../../../domain/identity/entities/Customer';
import { USER_ROLE } from '../../../../domain/identity/enums/user-role.enum';
import { PERMISSION_RESOURCE } from '../../../../domain/identity/enums/permission-resource.enum';
import { PERMISSION_ACTION } from '../../../../domain/identity/enums/permission-action.enum';
import { Permission } from '../../../../domain/identity/value-objects/Permission.vo';
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

describe('RbacService', () => {
  let rbac: RbacService;

  beforeEach(() => {
    rbac = new RbacService();
  });

  describe('can', () => {
    it('returns true for a super admin on any resource/action', () => {
      const superAdmin = makeSuperAdmin();

      expect(rbac.can(superAdmin, PERMISSION_RESOURCE.USER, PERMISSION_ACTION.DELETE)).toBe(true);
    });

    it('returns true for a scoped admin with the matching permission', () => {
      const admin = makeAdminWithUserUpdate();

      expect(rbac.can(admin, PERMISSION_RESOURCE.USER, PERMISSION_ACTION.UPDATE)).toBe(true);
    });

    it('returns false for a scoped admin without the permission', () => {
      const admin = makeAdminWithoutPermissions();

      expect(rbac.can(admin, PERMISSION_RESOURCE.USER, PERMISSION_ACTION.UPDATE)).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('returns true when the user role matches', () => {
      const customer = makeCustomer();

      expect(rbac.hasRole(customer, USER_ROLE.CUSTOMER)).toBe(true);
    });

    it('returns false when the user role does not match', () => {
      const customer = makeCustomer();

      expect(rbac.hasRole(customer, USER_ROLE.ADMIN)).toBe(false);
    });
  });

  describe('authorize', () => {
    it('returns Result.ok for a super admin', () => {
      const superAdmin = makeSuperAdmin();

      const result = rbac.authorize(superAdmin, PERMISSION_RESOURCE.USER, PERMISSION_ACTION.DELETE);

      expect(result.isSuccess).toBe(true);
    });

    it('returns Result.ok for a scoped admin with the matching permission', () => {
      const admin = makeAdminWithUserUpdate();

      const result = rbac.authorize(admin, PERMISSION_RESOURCE.USER, PERMISSION_ACTION.UPDATE);

      expect(result.isSuccess).toBe(true);
    });

    it('returns Result.fail with ForbiddenError for a scoped admin without the permission', () => {
      const admin = makeAdminWithoutPermissions();

      const result = rbac.authorize(admin, PERMISSION_RESOURCE.USER, PERMISSION_ACTION.UPDATE);

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBeInstanceOf(ForbiddenError);
    });
  });
});
