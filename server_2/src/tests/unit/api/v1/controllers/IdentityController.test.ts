import { Request, Response, NextFunction } from 'express';
import { IdentityController, IdentityControllerDeps } from '../../../../../api/v1/controllers/IdentityController';
import { Result } from '../../../../../domain/shared/Result';
import { NotFoundError } from '../../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../../domain/shared/errors/ForbiddenError';
import { UserResponse } from '../../../../../application/identity/responses/UserResponse';
import { USER_ROLE } from '../../../../../domain/identity/enums/user-role.enum';
import { PERMISSION_RESOURCE } from '../../../../../domain/identity/enums/permission-resource.enum';
import { PERMISSION_ACTION } from '../../../../../domain/identity/enums/permission-action.enum';

function mockUseCase() {
  return { execute: jest.fn() };
}

function buildDeps() {
  return {
    getProfile: mockUseCase(),
    updateProfile: mockUseCase(),
    assignRole: mockUseCase(),
    grantPermission: mockUseCase(),
    banUser: mockUseCase(),
    unbanUser: mockUseCase(),
  };
}

function mockRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    context: { requestId: 'req-1', ip: '127.0.0.1', userAgent: 'jest-agent', device: 'test-device' },
    ...overrides,
  } as unknown as Request;
}

const SELF_USER = {
  userId: 'user-1',
  role: USER_ROLE.CUSTOMER,
  sessionId: 'session-1',
  jti: 'jti-1',
  tokenVersion: 0,
};

const ADMIN_USER = {
  userId: 'admin-1',
  role: USER_ROLE.ADMIN,
  sessionId: 'session-1',
  jti: 'jti-1',
  tokenVersion: 0,
};

const USER_RESPONSE: UserResponse = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: USER_ROLE.CUSTOMER,
  isEmailVerified: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('IdentityController', () => {
  let deps: ReturnType<typeof buildDeps>;
  let controller: IdentityController;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    deps = buildDeps();
    controller = new IdentityController(deps as unknown as IdentityControllerDeps);
    res = mockRes();
    next = jest.fn();
  });

  describe('getMe', () => {
    it('returns 200 with the current user profile', async () => {
      deps.getProfile.execute.mockResolvedValue(Result.ok(USER_RESPONSE));
      const req = mockReq({ user: SELF_USER });

      await controller.getMe(req, res, next);

      expect(deps.getProfile.execute).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(USER_RESPONSE);
    });

    it('forwards the error to next on failure', async () => {
      const error = new NotFoundError('user_not_found');
      deps.getProfile.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ user: SELF_USER });

      await controller.getMe(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('updateMe', () => {
    it('updates the allowed profile fields and returns 200 with the updated profile', async () => {
      const updated = { ...USER_RESPONSE, name: 'New Name', avatarUrl: 'https://example.com/a.png' };
      deps.updateProfile.execute.mockResolvedValue(Result.ok(updated));
      const req = mockReq({ user: SELF_USER, body: { name: 'New Name', avatarUrl: 'https://example.com/a.png' } });

      await controller.updateMe(req, res, next);

      expect(deps.updateProfile.execute).toHaveBeenCalledWith({
        userId: 'user-1',
        name: 'New Name',
        avatarUrl: 'https://example.com/a.png',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updated);
    });

    it('forwards the error to next on failure', async () => {
      const error = new NotFoundError('user_not_found');
      deps.updateProfile.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ user: SELF_USER, body: { name: 'New Name' } });

      await controller.updateMe(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('assignRole', () => {
    it('assigns a role using actorId from req.user and targetUserId from params, returns 204', async () => {
      deps.assignRole.execute.mockResolvedValue(Result.ok());
      const req = mockReq({
        user: ADMIN_USER,
        params: { userId: 'target-user-1' },
        body: { role: USER_ROLE.DRIVER },
      });

      await controller.assignRole(req, res, next);

      expect(deps.assignRole.execute).toHaveBeenCalledWith({
        actorId: 'admin-1',
        targetUserId: 'target-user-1',
        role: USER_ROLE.DRIVER,
      });
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('forwards the error to next on failure', async () => {
      const error = new ForbiddenError('actor_not_admin');
      deps.assignRole.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({
        user: SELF_USER,
        params: { userId: 'target-user-1' },
        body: { role: USER_ROLE.DRIVER },
      });

      await controller.assignRole(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('grantPermission', () => {
    it('grants a permission using actorId from req.user and targetAdminId from params, returns 204', async () => {
      deps.grantPermission.execute.mockResolvedValue(Result.ok());
      const req = mockReq({
        user: ADMIN_USER,
        params: { adminId: 'target-admin-1' },
        body: { resource: PERMISSION_RESOURCE.USER, action: PERMISSION_ACTION.UPDATE, scope: 'region:eu' },
      });

      await controller.grantPermission(req, res, next);

      expect(deps.grantPermission.execute).toHaveBeenCalledWith({
        actorId: 'admin-1',
        targetAdminId: 'target-admin-1',
        resource: PERMISSION_RESOURCE.USER,
        action: PERMISSION_ACTION.UPDATE,
        scope: 'region:eu',
      });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('forwards the error to next on failure', async () => {
      const error = new NotFoundError('admin_not_found');
      deps.grantPermission.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({
        user: ADMIN_USER,
        params: { adminId: 'target-admin-1' },
        body: { resource: PERMISSION_RESOURCE.USER, action: PERMISSION_ACTION.UPDATE },
      });

      await controller.grantPermission(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('banUser', () => {
    it('bans the target user using actorId from req.user and targetUserId from params, returns 204', async () => {
      deps.banUser.execute.mockResolvedValue(Result.ok());
      const req = mockReq({
        user: ADMIN_USER,
        params: { userId: 'target-user-1' },
        body: { reason: 'fraud' },
      });

      await controller.banUser(req, res, next);

      expect(deps.banUser.execute).toHaveBeenCalledWith({
        actorId: 'admin-1',
        targetUserId: 'target-user-1',
        reason: 'fraud',
      });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('forwards the error to next on failure', async () => {
      const error = new ForbiddenError('actor_not_admin');
      deps.banUser.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({
        user: SELF_USER,
        params: { userId: 'target-user-1' },
        body: { reason: 'fraud' },
      });

      await controller.banUser(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('unbanUser', () => {
    it('unbans the target user using actorId from req.user and targetUserId from params, returns 204', async () => {
      deps.unbanUser.execute.mockResolvedValue(Result.ok());
      const req = mockReq({ user: ADMIN_USER, params: { userId: 'target-user-1' } });

      await controller.unbanUser(req, res, next);

      expect(deps.unbanUser.execute).toHaveBeenCalledWith({
        actorId: 'admin-1',
        targetUserId: 'target-user-1',
      });
      expect(res.status).toHaveBeenCalledWith(204);
    });

    it('forwards the error to next on failure', async () => {
      const error = new ForbiddenError('actor_not_admin');
      deps.unbanUser.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ user: SELF_USER, params: { userId: 'target-user-1' } });

      await controller.unbanUser(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
