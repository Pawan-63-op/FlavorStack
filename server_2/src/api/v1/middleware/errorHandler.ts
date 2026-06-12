// Global Express error handler — maps DomainErrors → HTTP codes
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { DomainError } from '../../../domain/shared/errors/DomainError';
import { logger } from '../../../infrastructure/observability/logger';

const CODE_STATUS_MAP: Record<string, number> = {
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
};

// ForbiddenError instances carrying these messages are authentication
// failures, not authorization failures — surface them as 401.
const AUTH_MESSAGE_OVERRIDES = new Set([
  'invalid_credentials',
  'invalid_token',
  'token_reuse_detected',
  'session_not_found',
  'token_version_mismatch',
  'user_not_found_or_inactive',
  'invalid_current_password',
]);

interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
}

function getRequestId(req: Request): string {
  if (req.context?.requestId) return req.context.requestId;
  const header = req.headers['x-request-id'];
  return typeof header === 'string' ? header : '';
}

function hideMessageInProd(message: string): string {
  return process.env.NODE_ENV === 'production' ? 'Internal server error' : message;
}

function resolveDomainErrorStatus(err: DomainError): number {
  switch (err.code) {
    case 'VALIDATION_ERROR':
      return 422;
    case 'CONFLICT':
      return 409;
    case 'NOT_FOUND':
      // No user enumeration: a missing-user login failure reads as 401, not 404.
      return err.message === 'invalid_credentials' ? 401 : 404;
    case 'FORBIDDEN':
      return AUTH_MESSAGE_OVERRIDES.has(err.message) ? 401 : 403;
    default:
      return CODE_STATUS_MAP[err.code] ?? 500;
  }
}

function formatZodIssues(err: ZodError): Array<{ path: string; message: string }> {
  return err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

function respond(res: Response, status: number, body: ErrorBody): void {
  res.status(status).json({ error: body });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = getRequestId(req);

  if (err instanceof ZodError) {
    respond(res, 422, {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: formatZodIssues(err),
      requestId,
    });
    return;
  }

  if (err instanceof DomainError) {
    const status = resolveDomainErrorStatus(err);
    if (status >= 500) {
      logger.error({ err, requestId }, 'Unhandled domain error');
      respond(res, status, { code: err.code, message: hideMessageInProd(err.message), requestId });
      return;
    }
    respond(res, status, { code: err.code, message: err.message, details: err.details, requestId });
    return;
  }

  logger.error({ err, requestId }, 'Unhandled error');
  const message = typeof err === 'string' ? err : err instanceof Error ? err.message : 'Internal server error';
  respond(res, 500, { code: 'INTERNAL_ERROR', message: hideMessageInProd(message), requestId });
}
