import { Request, Response, NextFunction } from 'express';
import { ReviewController, ReviewControllerDeps } from '../../../../../api/v1/controllers/ReviewController';
import { Result } from '../../../../../domain/shared/Result';
import { ConflictError } from '../../../../../domain/shared/errors/ConflictError';
import { NotFoundError } from '../../../../../domain/shared/errors/NotFoundError';

function mockUseCase() {
  return { execute: jest.fn() };
}

function buildDeps() {
  return {
    submitReview: mockUseCase(),
    getMyReviews: mockUseCase(),
    getRestaurantReviews: mockUseCase(),
    getRestaurantRating: mockUseCase(),
    moderateReview: mockUseCase(),
    listPendingReviews: mockUseCase(),
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
    user: { userId: 'customer-1', role: 'CUSTOMER', sessionId: 'session-1', jti: 'jti-1', tokenVersion: 0 },
    ...overrides,
  } as unknown as Request;
}

describe('ReviewController', () => {
  let deps: ReturnType<typeof buildDeps>;
  let controller: ReviewController;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    deps = buildDeps();
    controller = new ReviewController(deps as unknown as ReviewControllerDeps);
    res = mockRes();
    next = jest.fn();
  });

  describe('submit', () => {
    it('builds the SubmitReviewDto from the caller, params, and body, returns 201', async () => {
      const response = { reviewId: 'r-1' };
      deps.submitReview.execute.mockResolvedValue(Result.ok(response));
      const req = mockReq({
        params: { restaurantId: 'rest-1' },
        body: { fulfillmentId: 'ful-1', restaurantRating: 5, deliveryRating: 4, comment: 'great' },
      });

      await controller.submit(req, res, next);

      expect(deps.submitReview.execute).toHaveBeenCalledWith({
        customerId: 'customer-1',
        restaurantId: 'rest-1',
        fulfillmentId: 'ful-1',
        restaurantRating: 5,
        deliveryRating: 4,
        comment: 'great',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(response);
      expect(next).not.toHaveBeenCalled();
    });

    it('forwards the error to next when the review already exists', async () => {
      const error = new ConflictError('review_already_submitted');
      deps.submitReview.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({ params: { restaurantId: 'rest-1' }, body: { fulfillmentId: 'ful-1', restaurantRating: 5 } });

      await controller.submit(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('getMine', () => {
    it('returns the caller\'s reviews with parsed pagination', async () => {
      const response = [{ reviewId: 'r-1' }];
      deps.getMyReviews.execute.mockResolvedValue(Result.ok(response));
      const req = mockReq({ query: { limit: '10', offset: '0' } });

      await controller.getMine(req, res, next);

      expect(deps.getMyReviews.execute).toHaveBeenCalledWith({ customerId: 'customer-1', limit: 10, offset: 0 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(response);
    });
  });

  describe('getForRestaurant', () => {
    it('returns approved restaurant reviews', async () => {
      const response = [{ reviewId: 'r-1' }];
      deps.getRestaurantReviews.execute.mockResolvedValue(Result.ok(response));
      const req = mockReq({ params: { restaurantId: 'rest-1' } });

      await controller.getForRestaurant(req, res, next);

      expect(deps.getRestaurantReviews.execute).toHaveBeenCalledWith({
        restaurantId: 'rest-1',
        limit: undefined,
        offset: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(response);
    });
  });

  describe('getRating', () => {
    it('returns the restaurant rating aggregate', async () => {
      const response = { restaurantId: 'rest-1', avgRating: 4.5, reviewCount: 2, distribution: {} };
      deps.getRestaurantRating.execute.mockResolvedValue(Result.ok(response));
      const req = mockReq({ params: { restaurantId: 'rest-1' } });

      await controller.getRating(req, res, next);

      expect(deps.getRestaurantRating.execute).toHaveBeenCalledWith({ restaurantId: 'rest-1' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(response);
    });
  });

  describe('approve', () => {
    it('calls moderateReview with action APPROVE using the moderator id and review id param', async () => {
      const response = { reviewId: 'r-1', moderationStatus: 'APPROVED' };
      deps.moderateReview.execute.mockResolvedValue(Result.ok(response));
      const req = mockReq({
        user: { userId: 'admin-1', role: 'ADMIN', sessionId: 's-1', jti: 'j-1', tokenVersion: 0 },
        params: { id: 'r-1' },
        body: {},
      });

      await controller.approve(req, res, next);

      expect(deps.moderateReview.execute).toHaveBeenCalledWith({
        moderatorId: 'admin-1',
        reviewId: 'r-1',
        action: 'APPROVE',
        reason: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(response);
    });

    it('forwards the error to next when the review does not exist', async () => {
      const error = new NotFoundError('review_not_found');
      deps.moderateReview.execute.mockResolvedValue(Result.fail(error));
      const req = mockReq({
        user: { userId: 'admin-1', role: 'ADMIN', sessionId: 's-1', jti: 'j-1', tokenVersion: 0 },
        params: { id: 'missing' },
      });

      await controller.approve(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('calls moderateReview with action REJECT and the rejection reason', async () => {
      const response = { reviewId: 'r-1', moderationStatus: 'REJECTED' };
      deps.moderateReview.execute.mockResolvedValue(Result.ok(response));
      const req = mockReq({
        user: { userId: 'admin-1', role: 'ADMIN', sessionId: 's-1', jti: 'j-1', tokenVersion: 0 },
        params: { id: 'r-1' },
        body: { reason: 'spam' },
      });

      await controller.reject(req, res, next);

      expect(deps.moderateReview.execute).toHaveBeenCalledWith({
        moderatorId: 'admin-1',
        reviewId: 'r-1',
        action: 'REJECT',
        reason: 'spam',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(response);
    });
  });

  describe('listPending', () => {
    it('passes optional status filter and pagination to the use-case', async () => {
      const response = [{ reviewId: 'r-1' }];
      deps.listPendingReviews.execute.mockResolvedValue(Result.ok(response));
      const req = mockReq({ query: { status: 'AUTO_FLAGGED', limit: '20' } });

      await controller.listPending(req, res, next);

      expect(deps.listPendingReviews.execute).toHaveBeenCalledWith({
        status: 'AUTO_FLAGGED',
        limit: 20,
        offset: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(response);
    });
  });
});
