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
  let userRepository: InMemoryUserRepository;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
  });

  function deps() {
    return { userRepository, rbacService: new RbacService() };
  }

  async function seedAdmin(overrides: Partial<typeof ADMIN_INPUT> = {}): Promise<Admin> {
    const admin = Admin.createSuperAdmin({ ...ADMIN_INPUT, ...overrides });
    admin.pullDomainEvents();
    await userRepository.save(admin);
    return admin;
  }

  async function seedCustomer(email = 'customer@example.com'): Promise<Customer> {
    const customer = Customer.create({
      name: 'Test User',
      email,
      phone: '+919876543210',
      passwordHash: 'hashed:Password1!',
      referralCode: 'REF00001',
    });
    customer.pullDomainEvents();
    await userRepository.save(customer);
    return customer;
  }

  it('calls next() when req.user.role is in the allowed set and the actor is live', async () => {
    const admin = await seedAdmin();
    const req = mockReq({ userId: admin._id, role: USER_ROLE.ADMIN, sessionId: 's1', jti: 'j1', tokenVersion: admin.tokenVersion });
    const next = jest.fn();

    await requireRole(deps(), USER_ROLE.ADMIN)(req, mockRes(), next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with ForbiddenError("invalid_token") when req.user is missing', async () => {
    const req = mockReq(undefined);
    const next = jest.fn();

    await requireRole(deps(), USER_ROLE.ADMIN)(req, mockRes(), next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect((next.mock.calls[0][0] as ForbiddenError).message).toBe('invalid_token');
  });

  it('denies a CUSTOMER on a DRIVER route with "insufficient_role" naming the required role', async () => {
    const customer = await seedCustomer();
    const req = mockReq({ userId: customer._id, role: USER_ROLE.CUSTOMER, sessionId: 's1', jti: 'j1', tokenVersion: 0 });
    const next = jest.fn();

    await requireRole(deps(), USER_ROLE.DRIVER)(req, mockRes(), next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    const err = next.mock.calls[0][0] as ForbiddenError;
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toContain('insufficient_role');
    expect(err.message).toContain(USER_ROLE.DRIVER);
    expect(err.message).not.toBe('actor_not_admin');
  });

  it('denies a banned actor holding a valid token with "account_locked_or_banned"', async () => {
    const admin = Admin.createSuperAdmin({ ...ADMIN_INPUT, email: 'banned-role@example.com' });
    admin.pullDomainEvents();
    const tokenVersion = admin.tokenVersion;
    admin.ban('policy violation');
    admin.pullDomainEvents();
    await userRepository.save(admin);

    const req = mockReq({ userId: admin._id, role: USER_ROLE.ADMIN, sessionId: 's1', jti: 'j1', tokenVersion });
    const next = jest.fn();

    await requireRole(deps(), USER_ROLE.ADMIN)(req, mockRes(), next as NextFunction);

    expect((next.mock.calls[0][0] as ForbiddenError).message).toBe('account_locked_or_banned');
  });

  it('denies an actor that no longer exists with "account_locked_or_banned"', async () => {
    const req = mockReq({ userId: 'missing-user', role: USER_ROLE.ADMIN, sessionId: 's1', jti: 'j1', tokenVersion: 0 });
    const next = jest.fn();

    await requireRole(deps(), USER_ROLE.ADMIN)(req, mockRes(), next as NextFunction);

    expect((next.mock.calls[0][0] as ForbiddenError).message).toBe('account_locked_or_banned');
  });

  it('denies a stale tokenVersion with "token_version_mismatch" (mapped to 401)', async () => {
    const admin = await seedAdmin({ email: 'stale@example.com' });
    const req = mockReq({
      userId: admin._id,
      role: USER_ROLE.ADMIN,
      sessionId: 's1',
      jti: 'j1',
      tokenVersion: admin.tokenVersion - 1,
    });
    const next = jest.fn();

    await requireRole(deps(), USER_ROLE.ADMIN)(req, mockRes(), next as NextFunction);

    expect((next.mock.calls[0][0] as ForbiddenError).message).toBe('token_version_mismatch');
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
