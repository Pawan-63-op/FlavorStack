// Require + canonicalize the Idempotency-Key header on the checkout command (§9; commerce_module.md §4.4
// step 0). Checkout is an unsafe POST, so the client must supply a stable UUID key that survives retries;
// this middleware enforces presence + UUID shape and stashes the canonical (trimmed, lower-cased) value on
// req.idempotencyKey for the controller to forward into the Checkout DTO.
//
// Dedup itself is NOT performed here (no Redis 409): a replay is a *success* that returns the original
// OrderRequest. The Checkout use case returns the first result on replay, and the unique
// order_requests.idempotencyKey index is the persistence-level duplicate guard. This middleware only
// guarantees a well-formed key reaches the use case.
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
