import { Request, Response, NextFunction, RequestHandler } from 'express';
import { RateLimiter, RateLimitAction } from '../../../infrastructure/redis/RateLimiter';
import { logger } from '../../../infrastructure/observability/logger';

export function rateLimit(rateLimiter: RateLimiter, action: RateLimitAction): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identifier = req.user?.userId ?? req.context?.ip ?? 'unknown';

    try {
      const result = await rateLimiter.check(action, identifier);

      if (!result.allowed) {
        res.setHeader('Retry-After', String(result.retryAfter));
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            requestId: req.context?.requestId ?? '',
          },
        });
        return;
      }

      next();
    } catch (err) {
      logger.warn({ err, action, identifier }, 'rate limiter unavailable, failing open');
      next();
    }
  };
}
