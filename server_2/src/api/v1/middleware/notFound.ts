// Catch-all 404 handler
import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`route_not_found: ${req.method} ${req.originalUrl}`));
}
