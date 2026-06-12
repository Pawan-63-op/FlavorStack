// Emits a structured audit log entry once the response finishes. Non-blocking:
// never delays or fails the response, even if logging itself throws.
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../../../infrastructure/observability/logger';

export function audit(action: string): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      try {
        logger.info(
          {
            action,
            actorId: req.user?.userId,
            target: req.params,
            status: res.statusCode,
            requestId: req.context?.requestId,
          },
          'audit',
        );
      } catch (err) {
        logger.warn({ err, action }, 'audit logging failed');
      }
    });

    next();
  };
}
