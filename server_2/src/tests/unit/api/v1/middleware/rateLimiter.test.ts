import { Request, Response, NextFunction } from 'express';
import { rateLimit } from '../../../../../api/v1/middleware/rateLimiter';
import { RateLimiter, RateLimitResult } from '../../../../../infrastructure/redis/RateLimiter';

jest.mock('../../../../../infrastructure/observability/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { logger } from '../../../../../infrastructure/observability/logger';

function mockRes(): Response {
  const res = {} as Response;
  res.setHeader = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return { context: { requestId: 'req-1', ip: '1.2.3.4' }, ...overrides } as unknown as Request;
}

function fakeRateLimiter(check: jest.Mock): RateLimiter {
  return { check } as unknown as RateLimiter;
}

describe('rateLimit middleware', () => {
  it('calls next() when the request is within the limit', async () => {
    const result: RateLimitResult = { allowed: true, remaining: 4, retryAfter: 0 };
    const check = jest.fn().mockResolvedValue(result);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await rateLimit(fakeRateLimiter(check), 'login')(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('responds 429 with Retry-After and a structured body when blocked', async () => {
    const result: RateLimitResult = { allowed: false, remaining: 0, retryAfter: 42 };
    const check = jest.fn().mockResolvedValue(result);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await rateLimit(fakeRateLimiter(check), 'login')(req, res, next as NextFunction);

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '42');
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'RATE_LIMIT_EXCEEDED', message: expect.any(String), requestId: 'req-1' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('uses req.user.userId as the identifier when authenticated', async () => {
    const result: RateLimitResult = { allowed: true, remaining: 1, retryAfter: 0 };
    const check = jest.fn().mockResolvedValue(result);
    const req = mockReq({ user: { userId: 'user-1', role: 'CUSTOMER', sessionId: 's', jti: 'j', tokenVersion: 0 } } as any);
    const res = mockRes();
    const next = jest.fn();

    await rateLimit(fakeRateLimiter(check), 'otp-generation')(req, res, next as NextFunction);

    expect(check).toHaveBeenCalledWith('otp-generation', 'user-1');
  });

  it('falls back to req.context.ip as the identifier when not authenticated', async () => {
    const result: RateLimitResult = { allowed: true, remaining: 1, retryAfter: 0 };
    const check = jest.fn().mockResolvedValue(result);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await rateLimit(fakeRateLimiter(check), 'login')(req, res, next as NextFunction);

    expect(check).toHaveBeenCalledWith('login', '1.2.3.4');
  });

  it('fails open and logs a warning when the rate limiter throws', async () => {
    const check = jest.fn().mockRejectedValue(new Error('redis down'));
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await rateLimit(fakeRateLimiter(check), 'login')(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });
});
