import { Request, Response, NextFunction } from 'express';
import {
  DashboardAnalyticsController,
  DashboardAnalyticsControllerDeps,
} from '../../../../../api/v1/controllers/fulfillment/DashboardAnalyticsController';
import { Result } from '../../../../../domain/shared/Result';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

function mockUseCase() {
  return { execute: jest.fn() };
}

function buildDeps() {
  return { getDashboardAnalytics: mockUseCase() };
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
    user: { userId: 'owner-1', role: 'CUSTOMER', sessionId: 's-1', jti: 'j-1', tokenVersion: 0 },
    ...overrides,
  } as unknown as Request;
}

describe('DashboardAnalyticsController', () => {
  let deps: ReturnType<typeof buildDeps>;
  let controller: DashboardAnalyticsController;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    deps = buildDeps();
    controller = new DashboardAnalyticsController(deps as unknown as DashboardAnalyticsControllerDeps);
    res = mockRes();
    next = jest.fn();
  });

  describe('getOwner', () => {
    it('builds an OWNER dto from the caller and days, returns 200', async () => {
      const payload = { scope: 'OWNER' };
      deps.getDashboardAnalytics.execute.mockResolvedValue(Result.ok(payload));

      await controller.getOwner(mockReq({ query: { days: '7' } }), res, next);

      expect(deps.getDashboardAnalytics.execute).toHaveBeenCalledWith({
        scope: 'OWNER',
        ownerId: 'owner-1',
        windowDays: 7,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(payload);
      expect(next).not.toHaveBeenCalled();
    });

    it('omits windowDays when days is not supplied', async () => {
      deps.getDashboardAnalytics.execute.mockResolvedValue(Result.ok({}));

      await controller.getOwner(mockReq(), res, next);

      expect(deps.getDashboardAnalytics.execute).toHaveBeenCalledWith({
        scope: 'OWNER',
        ownerId: 'owner-1',
        windowDays: undefined,
      });
    });

    it('forwards a use-case failure to next without responding', async () => {
      deps.getDashboardAnalytics.execute.mockResolvedValue(Result.fail(new ValidationError('bad')));

      await controller.getOwner(mockReq(), res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('getPlatform', () => {
    it('builds a PLATFORM dto (no ownerId) from days, returns 200', async () => {
      const payload = { scope: 'PLATFORM' };
      deps.getDashboardAnalytics.execute.mockResolvedValue(Result.ok(payload));

      await controller.getPlatform(mockReq({ query: { days: '30' } }), res, next);

      expect(deps.getDashboardAnalytics.execute).toHaveBeenCalledWith({
        scope: 'PLATFORM',
        windowDays: 30,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(payload);
    });
  });
});
