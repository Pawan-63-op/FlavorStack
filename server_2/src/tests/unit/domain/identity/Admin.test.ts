import { Admin } from '../../../../domain/identity/entities/Admin';
import { USER_ROLE } from '../../../../domain/identity/enums/user-role.enum';
import { PERMISSION_RESOURCE } from '../../../../domain/identity/enums/permission-resource.enum';
import { PERMISSION_ACTION } from '../../../../domain/identity/enums/permission-action.enum';
import { Permission } from '../../../../domain/identity/value-objects/Permission.vo';
import { UserRegistered } from '../../../../domain/identity/events/UserRegistered';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';

describe('Admin Entity', () => {
  const validAdminInput = {
    name: 'Admin User',
    email: 'admin@example.com',
    phone: '+919876543212',
    passwordHash: 'hashedpassword123',
    department: 'Operations',
  };

  describe('creation', () => {
    it('should create an admin, default super admin to false, and record UserRegistered event', () => {
      const admin = Admin.create(validAdminInput);

      expect(admin).toBeDefined();
      expect(admin.role).toBe(USER_ROLE.ADMIN);
      expect(admin.isSuperAdmin).toBe(false);
      expect(admin.permissions).toEqual([]);

      const events = admin.pullDomainEvents();
      expect(events.length).toBe(1);
      const event = events[0] as UserRegistered;
      expect(event).toBeInstanceOf(UserRegistered);
      expect(event.aggregateId).toBe(admin._id);
    });

    it('should create a super admin with isSuperAdmin set to true', () => {
      const admin = Admin.createSuperAdmin(validAdminInput);

      expect(admin).toBeDefined();
      expect(admin.isSuperAdmin).toBe(true);
    });
  });

  describe('permission checks', () => {
    it('should allow super admin access to any permission', () => {
      const admin = Admin.createSuperAdmin(validAdminInput);

      expect(admin.hasPermission(PERMISSION_RESOURCE.ORDER, PERMISSION_ACTION.CREATE)).toBe(true);
      expect(() => {
        admin.assertPermission(PERMISSION_RESOURCE.REPORT, PERMISSION_ACTION.DELETE);
      }).not.toThrow();
    });

    it('should allow access to assigned permissions for regular admin', () => {
      const permission = Permission.create({
        resource: PERMISSION_RESOURCE.ORDER,
        action: PERMISSION_ACTION.READ,
      }).getValue();

      const admin = Admin.create({
        ...validAdminInput,
        permissions: [permission],
      });

      expect(admin.hasPermission(PERMISSION_RESOURCE.ORDER, PERMISSION_ACTION.READ)).toBe(true);
      expect(admin.hasPermission(PERMISSION_RESOURCE.ORDER, PERMISSION_ACTION.CREATE)).toBe(false);

      expect(() => {
        admin.assertPermission(PERMISSION_RESOURCE.ORDER, PERMISSION_ACTION.READ);
      }).not.toThrow();

      expect(() => {
        admin.assertPermission(PERMISSION_RESOURCE.ORDER, PERMISSION_ACTION.CREATE);
      }).toThrow(ForbiddenError);
    });
  });

  describe('permission management', () => {
    it('should grant permission if not already possessed, raising no domain event', () => {
      const admin = Admin.create(validAdminInput);
      admin.clearDomainEvents();

      const permission = Permission.create({
        resource: PERMISSION_RESOURCE.MENU,
        action: PERMISSION_ACTION.UPDATE,
        scope: 'branch-1',
      }).getValue();

      admin.grantPermission(permission);

      expect(admin.permissions.length).toBe(1);
      expect(admin.permissions[0]).toBe(permission);
      expect(admin.pullDomainEvents()).toEqual([]);
    });

    it('should not duplicate permission or raise event if already possessed', () => {
      const permission = Permission.create({
        resource: PERMISSION_RESOURCE.MENU,
        action: PERMISSION_ACTION.UPDATE,
      }).getValue();

      const admin = Admin.create({
        ...validAdminInput,
        permissions: [permission],
      });
      admin.clearDomainEvents();

      admin.grantPermission(permission);

      expect(admin.permissions.length).toBe(1);
      const events = admin.pullDomainEvents();
      expect(events.length).toBe(0);
    });
  });

  describe('banning checks', () => {
    it('should allow any admin to assert ban on non-admin users', () => {
      const admin = Admin.create(validAdminInput);

      expect(() => {
        admin.assertCanBan(USER_ROLE.CUSTOMER);
      }).not.toThrow();
      expect(() => {
        admin.assertCanBan(USER_ROLE.DRIVER);
      }).not.toThrow();
    });

    it('should throw ForbiddenError when non-super admin tries to ban another admin', () => {
      const admin = Admin.create(validAdminInput);

      expect(() => {
        admin.assertCanBan(USER_ROLE.ADMIN);
      }).toThrow(ForbiddenError);
    });

    it('should allow super admin to ban another admin', () => {
      const admin = Admin.createSuperAdmin(validAdminInput);

      expect(() => {
        admin.assertCanBan(USER_ROLE.ADMIN);
      }).not.toThrow();
    });
  });

  describe('role assignment', () => {
    it('should authorise a role assignment when admin has update user permission', () => {
      const permission = Permission.create({
        resource: PERMISSION_RESOURCE.USER,
        action: PERMISSION_ACTION.UPDATE,
      }).getValue();

      const admin = Admin.create({
        ...validAdminInput,
        permissions: [permission],
      });
      admin.clearDomainEvents();

      expect(() => admin.assignRole(USER_ROLE.DRIVER)).not.toThrow();
      expect(admin.pullDomainEvents()).toEqual([]);
    });

    it('should throw ForbiddenError when assigning admin role by regular admin', () => {
      const permission = Permission.create({
        resource: PERMISSION_RESOURCE.USER,
        action: PERMISSION_ACTION.UPDATE,
      }).getValue();

      const admin = Admin.create({
        ...validAdminInput,
        permissions: [permission],
      });

      expect(() => {
        admin.assignRole(USER_ROLE.ADMIN);
      }).toThrow(ForbiddenError);
    });

    it('should allow super admin to assign admin role', () => {
      const admin = Admin.createSuperAdmin(validAdminInput);
      admin.clearDomainEvents();

      expect(() => admin.assignRole(USER_ROLE.ADMIN)).not.toThrow();
      expect(admin.pullDomainEvents()).toEqual([]);
    });

    it('should throw ForbiddenError when admin without user update permission tries to assign role', () => {
      const admin = Admin.create(validAdminInput); // No permissions

      expect(() => {
        admin.assignRole(USER_ROLE.DRIVER);
      }).toThrow(ForbiddenError);
    });
  });
});
