import { Request, Response, NextFunction } from 'express';
import {
  NotificationController,
  NotificationControllerDeps,
} from '../../../../../api/v1/controllers/NotificationController';
import { Result } from '../../../../../domain/shared/Result';
import { NotFoundError } from '../../../../../domain/shared/errors/NotFoundError';

function mockUseCase() {
  return { execute: jest.fn() };
}

function buildDeps() {
  return {
    updateNotificationPreferences: mockUseCase(),
    getNotificationPreferences: mockUseCase(),
    getNotificationHistory: mockUseCase(),
    getUnreadCount: mockUseCase(),
    markNotificationRead: mockUseCase(),
  };
}

function mockRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    user: { userId: 'user-1', role: 'CUSTOMER', sessionId: 'session-1', jti: 'jti-1', tokenVersion: 0 },
    ...overrides,
  } as unknown as Request;
}

describe('NotificationController', () => {
  let deps: ReturnType<typeof buildDeps>;
  let controller: NotificationController;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    deps = buildDeps();
    controller = new NotificationController(deps as unknown as NotificationControllerDeps);
    res = mockRes();
    next = jest.fn();
  });

  describe('getPreferences', () => {
    it('returns 200 with the preference response for the authenticated user', async () => {
      const response = { userId: 'user-1', channels: {}, updatedAt: '2026-01-01T00:00:00.000Z' };
      deps.getNotificationPreferences.execute.mockResolvedValue(Result.ok(response));

      await controller.getPreferences(mockReq(), res, next);

      expect(deps.getNotificationPreferences.execute).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(response);
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards the error to next on failure', async () => {
      const error = new NotFoundError('user_not_found');
      deps.getNotificationPreferences.execute.mockResolvedValue(Result.fail(error));

      await controller.getPreferences(mockReq(), res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('updatePreferences', () => {
    it('passes userId + body changes to the use-case and returns 200', async () => {
      const changes = [{ category: 'PROMOTIONS', channel: 'PUSH', enabled: false }];
      const response = { userId: 'user-1', channels: {}, updatedAt: '2026-01-01T00:00:00.000Z' };
      deps.updateNotificationPreferences.execute.mockResolvedValue(Result.ok(response));
      const req = mockReq({ body: { changes } });

      await controller.updatePreferences(req, res, next);

      expect(deps.updateNotificationPreferences.execute).toHaveBeenCalledWith({ userId: 'user-1', changes });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(response);
    });
  });

  describe('getHistory', () => {
    it('parses limit/offset query params to numbers and returns 200', async () => {
      const response = [{ notificationId: 'n-1' }];
      deps.getNotificationHistory.execute.mockResolvedValue(Result.ok(response));
      const req = mockReq({ query: { limit: '10', offset: '5' } });

      await controller.getHistory(req, res, next);

      expect(deps.getNotificationHistory.execute).toHaveBeenCalledWith({
        userId: 'user-1',
        limit: 10,
        offset: 5,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(response);
    });

    it('omits limit/offset when not provided', async () => {
      deps.getNotificationHistory.execute.mockResolvedValue(Result.ok([]));

      await controller.getHistory(mockReq(), res, next);

      expect(deps.getNotificationHistory.execute).toHaveBeenCalledWith({
        userId: 'user-1',
        limit: undefined,
        offset: undefined,
      });
    });
  });

  describe('getUnreadCount', () => {
    it('returns 200 with the unread count', async () => {
      deps.getUnreadCount.execute.mockResolvedValue(Result.ok({ count: 3 }));

      await controller.getUnreadCount(mockReq(), res, next);

      expect(deps.getUnreadCount.execute).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ count: 3 });
    });
  });

  describe('markRead', () => {
    it('passes userId + notification id param to the use-case and returns 200', async () => {
      const response = { notificationId: 'n-1', status: 'READ' };
      deps.markNotificationRead.execute.mockResolvedValue(Result.ok(response));
      const req = mockReq({ params: { id: 'n-1' } });

      await controller.markRead(req, res, next);

      expect(deps.markNotificationRead.execute).toHaveBeenCalledWith({
        userId: 'user-1',
        notificationId: 'n-1',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(response);
    });

    it('forwards the error to next when the notification is not owned by the caller', async () => {
      const error = new NotFoundError('notification_not_found');
      deps.markNotificationRead.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ params: { id: 'n-1' } });

      await controller.markRead(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
