import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';

const IDEMPOTENCY_HEADER = 'Idempotency-Key';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function requireIdempotencyKey(req: Request, _res: Response, next: NextFunction): void {
  const raw = req.header(IDEMPOTENCY_HEADER);
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : '';

  if (!UUID_REGEX.test(normalized)) {
    next(new ValidationError('Idempotency-Key header is required and must be a valid UUID'));
    return;
  }

  req.idempotencyKey = normalized;
  next();
}
