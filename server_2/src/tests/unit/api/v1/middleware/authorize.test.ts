import { Request, Response, NextFunction } from 'express';
import { requireRole, requirePermission } from '../../../../../api/v1/middleware/authorize';
import { InMemoryUserRepository } from '../../../../mocks/identity.mocks';
import { RbacService } from '../../../../../infrastructure/auth/RbacService';
import { Admin } from '../../../../../domain/identity/entities/Admin';
import { Customer } from '../../../../../domain/identity/entities/Customer';
import { USER_ROLE } from '../../../../../domain/identity/enums/user-role.enum';
import { PERMISSION_RESOURCE } from '../../../../../domain/identity/enums/permission-resource.enum';
import { PERMISSION_ACTION } from '../../../../../domain/identity/enums/permission-action.enum';
import { Permission } from '../../../../../domain/identity/value-objects/Permission.vo';
import { ForbiddenError } from '../../../../../domain/shared/errors/ForbiddenError';

function mockRes(): Response {
  return {} as Response;
}

function mockReq(user?: Request['user']): Request {
  return { user } as unknown as Request;
}

const ADMIN_INPUT = {
  name: 'Admin User',
  email: 'admin@example.com',
  phone: '+919876543212',
  passwordHash: 'hashedpassword123',
  department: 'Operations',
};

describe('requireRole middleware', () => {
  it('calls next() when req.user.role is in the allowed set', () => {
    const req = mockReq({ userId: 'u1', role: USER_ROLE.ADMIN, sessionId: 's1', jti: 'j1', tokenVersion: 0 });
    const res = mockRes();
    const next = jest.fn();

    requireRole(USER_ROLE.ADMIN)(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with ForbiddenError("invalid_token") when req.user is missing', () => {
    const req = mockReq(undefined);
    const res = mockRes();
    const next = jest.fn();

    requireRole(USER_ROLE.ADMIN)(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect((next.mock.calls[0][0] as ForbiddenError).message).toBe('invalid_token');
  });

  it('calls next with a 403 ForbiddenError when the role is not allowed', () => {
    const req = mockReq({ userId: 'u1', role: USER_ROLE.CUSTOMER, sessionId: 's1', jti: 'j1', tokenVersion: 0 });
    const res = mockRes();
    const next = jest.fn();

    requireRole(USER_ROLE.ADMIN)(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    const err = next.mock.calls[0][0] as ForbiddenError;
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('actor_not_admin');
  });
});

describe('requirePermission middleware', () => {
  let userRepository: InMemoryUserRepository;
  let rbacService: RbacService;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    rbacService = new RbacService();
  });

  function deps() {
    return { userRepository, rbacService };
  }

  it('allows a super admin regardless of granted permissions', async () => {
    const admin = Admin.createSuperAdmin(ADMIN_INPUT);
    admin.pullDomainEvents();
    await userRepository.save(admin);

    const req = mockReq({ userId: admin._id, role: USER_ROLE.ADMIN, sessionId: 's1', jti: 'j1', tokenVersion: 0 });
    const res = mockRes();
    const next = jest.fn();

    await requirePermission(deps(), PERMISSION_RESOURCE.USER, PERMISSION_ACTION.DELETE)(
      req,
      res,
      next as NextFunction,
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('allows a scoped admin with the matching permission', async () => {
    const permission = Permission.create({
      resource: PERMISSION_RESOURCE.USER,
      action: PERMISSION_ACTION.UPDATE,
    }).getValue();
    const admin = Admin.create({ ...ADMIN_INPUT, email: 'scoped@example.com', permissions: [permission] });
    admin.pullDomainEvents();
    await userRepository.save(admin);

    const req = mockReq({ userId: admin._id, role: USER_ROLE.ADMIN, sessionId: 's1', jti: 'j1', tokenVersion: 0 });
    const res = mockRes();
    const next = jest.fn();

    await requirePermission(deps(), PERMISSION_RESOURCE.USER, PERMISSION_ACTION.UPDATE)(
      req,
      res,
      next as NextFunction,
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('denies a scoped admin without the matching permission with a 403 ForbiddenError', async () => {
    const admin = Admin.create({ ...ADMIN_INPUT, email: 'noperm@example.com' });
    admin.pullDomainEvents();
    await userRepository.save(admin);

    const req = mockReq({ userId: admin._id, role: USER_ROLE.ADMIN, sessionId: 's1', jti: 'j1', tokenVersion: 0 });
    const res = mockRes();
    const next = jest.fn();

    await requirePermission(deps(), PERMISSION_RESOURCE.USER, PERMISSION_ACTION.UPDATE)(
      req,
      res,
      next as NextFunction,
    );

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    const err = next.mock.calls[0][0] as ForbiddenError;
    expect(err.code).toBe('FORBIDDEN');
  });

  it('denies a non-admin user with a 403 ForbiddenError("actor_not_admin")', async () => {
    const customer = Customer.create({
      name: 'Test User',
      email: 'user@example.com',
      phone: '+919876543210',
      passwordHash: 'hashed:Password1!',
      referralCode: 'REF00001',
    });
    customer.pullDomainEvents();
    await userRepository.save(customer);

    const req = mockReq({ userId: customer._id, role: USER_ROLE.CUSTOMER, sessionId: 's1', jti: 'j1', tokenVersion: 0 });
    const res = mockRes();
    const next = jest.fn();

    await requirePermission(deps(), PERMISSION_RESOURCE.USER, PERMISSION_ACTION.UPDATE)(
      req,
      res,
      next as NextFunction,
    );

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    const err = next.mock.calls[0][0] as ForbiddenError;
    expect(err.message).toBe('actor_not_admin');
  });

  it('denies when the user aggregate cannot be found with a 403 ForbiddenError("actor_not_admin")', async () => {
    const req = mockReq({ userId: 'missing-user', role: USER_ROLE.ADMIN, sessionId: 's1', jti: 'j1', tokenVersion: 0 });
    const res = mockRes();
    const next = jest.fn();

    await requirePermission(deps(), PERMISSION_RESOURCE.USER, PERMISSION_ACTION.UPDATE)(
      req,
      res,
      next as NextFunction,
    );

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect((next.mock.calls[0][0] as ForbiddenError).message).toBe('actor_not_admin');
  });

  it('denies a banned admin with a 403 ForbiddenError("account_locked_or_banned")', async () => {
    const admin = Admin.createSuperAdmin({ ...ADMIN_INPUT, email: 'banned@example.com' });
    admin.pullDomainEvents();
    admin.ban('policy violation');
    admin.pullDomainEvents();
    await userRepository.save(admin);

    const req = mockReq({ userId: admin._id, role: USER_ROLE.ADMIN, sessionId: 's1', jti: 'j1', tokenVersion: 0 });
    const res = mockRes();
    const next = jest.fn();

    await requirePermission(deps(), PERMISSION_RESOURCE.USER, PERMISSION_ACTION.UPDATE)(
      req,
      res,
      next as NextFunction,
    );

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect((next.mock.calls[0][0] as ForbiddenError).message).toBe('account_locked_or_banned');
  });

  it('calls next with ForbiddenError("invalid_token") when req.user is missing', async () => {
    const req = mockReq(undefined);
    const res = mockRes();
    const next = jest.fn();

    await requirePermission(deps(), PERMISSION_RESOURCE.USER, PERMISSION_ACTION.UPDATE)(
      req,
      res,
      next as NextFunction,
    );

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect((next.mock.calls[0][0] as ForbiddenError).message).toBe('invalid_token');
  });
});
