import { Request, Response, NextFunction } from 'express';
import {
  FulfillmentController,
  FulfillmentControllerDeps,
} from '../../../../../api/v1/controllers/fulfillment/FulfillmentController';
import {
  restaurantIdParam,
  restaurantFulfillmentsQuery,
} from '../../../../../api/v1/validators/fulfillment/fulfillment.validator';
import { Result } from '../../../../../domain/shared/Result';
import { NotFoundError } from '../../../../../domain/shared/errors/NotFoundError';

function mockUseCase() {
  return { execute: jest.fn() };
}

function buildDeps() {
  return {
    markPreparing: mockUseCase(),
    markReadyForPickup: mockUseCase(),
    getRestaurantFulfillments: mockUseCase(),
    cancelFulfillment: mockUseCase(),
    getLiveTracking: mockUseCase(),
    listCustomerOrders: mockUseCase(),
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
    user: { userId: 'owner-1', role: 'CUSTOMER', sessionId: 's-1', jti: 'j-1', tokenVersion: 0 },
    ...overrides,
  } as unknown as Request;
}

describe('FulfillmentController', () => {
  let deps: ReturnType<typeof buildDeps>;
  let controller: FulfillmentController;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    deps = buildDeps();
    controller = new FulfillmentController(deps as unknown as FulfillmentControllerDeps);
    res = mockRes();
    next = jest.fn();
  });

  describe('getRestaurantFulfillments', () => {
    it('passes the restaurantId param through and returns 200 with the queue', async () => {
      const payload = [{ fulfillmentId: 'f-1', lines: [], deliveryAddress: {} }];
      deps.getRestaurantFulfillments.execute.mockResolvedValue(Result.ok(payload));

      await controller.getRestaurantFulfillments(mockReq({ params: { restaurantId: 'rest-1' } }), res, next);

      expect(deps.getRestaurantFulfillments.execute).toHaveBeenCalledWith({
        restaurantId: 'rest-1',
        status: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(payload);
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards the status query param to the use case', async () => {
      deps.getRestaurantFulfillments.execute.mockResolvedValue(Result.ok([]));

      await controller.getRestaurantFulfillments(
        mockReq({ params: { restaurantId: 'rest-1' }, query: { status: 'PREPARING' } }),
        res,
        next
      );

      expect(deps.getRestaurantFulfillments.execute).toHaveBeenCalledWith({
        restaurantId: 'rest-1',
        status: 'PREPARING',
      });
    });

    it('delegates a failed Result to next() instead of responding', async () => {
      const error = new NotFoundError('Restaurant not found');
      deps.getRestaurantFulfillments.execute.mockResolvedValue(Result.fail(error));

      await controller.getRestaurantFulfillments(mockReq({ params: { restaurantId: 'rest-1' } }), res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    /**
     * Behaviour pin, not an endorsement. The route is `auth`-only: the controller reads the
     * restaurantId straight from the URL and never compares it against `req.user`, so any
     * authenticated user can read any restaurant's queue — including customer ids and delivery
     * addresses. The admin UI mitigates this by sourcing its restaurant picker from the
     * caller's own restaurants (`RestaurantQueue.tsx` documents it as a UX mitigation, not a
     * security control). Pinned so closing the gap is a deliberate, visible change.
     */
    it('does not scope the queue to the caller — any authenticated user may read any restaurant', async () => {
      deps.getRestaurantFulfillments.execute.mockResolvedValue(Result.ok([]));

      await controller.getRestaurantFulfillments(
        mockReq({
          params: { restaurantId: 'someone-elses-restaurant' },
          user: { userId: 'unrelated-user', role: 'CUSTOMER' } as Request['user'],
        }),
        res,
        next
      );

      expect(deps.getRestaurantFulfillments.execute).toHaveBeenCalledWith({
        restaurantId: 'someone-elses-restaurant',
        status: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('route validators', () => {
    it('restaurantIdParam rejects an empty restaurantId', () => {
      expect(restaurantIdParam.safeParse({ restaurantId: 'rest-1' }).success).toBe(true);
      expect(restaurantIdParam.safeParse({ restaurantId: '' }).success).toBe(false);
      expect(restaurantIdParam.safeParse({}).success).toBe(false);
    });

    it('restaurantFulfillmentsQuery treats status as optional', () => {
      expect(restaurantFulfillmentsQuery.safeParse({}).success).toBe(true);
      expect(restaurantFulfillmentsQuery.safeParse({ status: 'PREPARING' }).success).toBe(true);
      expect(restaurantFulfillmentsQuery.safeParse({ status: 123 }).success).toBe(false);
    });
  });
});
