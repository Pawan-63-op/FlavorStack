import { z, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../../../../api/v1/middleware/errorHandler';
import { DomainError } from '../../../../../domain/shared/errors/DomainError';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';
import { ConflictError } from '../../../../../domain/shared/errors/ConflictError';
import { NotFoundError } from '../../../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../../../domain/shared/errors/ForbiddenError';

jest.mock('../../../../../infrastructure/observability/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

function mockRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(requestId = 'req-1'): Request {
  return { context: { requestId }, headers: {} } as unknown as Request;
}

describe('errorHandler', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('maps ValidationError to 422', () => {
    const req = mockReq();
    const res = mockRes();

    errorHandler(new ValidationError('bad_input'), req, res, jest.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'VALIDATION_ERROR', message: 'bad_input', requestId: 'req-1' },
    });
  });

  it('maps ConflictError to 409', () => {
    const req = mockReq();
    const res = mockRes();

    errorHandler(new ConflictError('email_already_registered'), req, res, jest.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'CONFLICT', message: 'email_already_registered', requestId: 'req-1' },
    });
  });

  it('maps NotFoundError to 404', () => {
    const req = mockReq();
    const res = mockRes();

    errorHandler(new NotFoundError('user_not_found'), req, res, jest.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('maps NotFoundError("invalid_credentials") to 401 to avoid user enumeration', () => {
    const req = mockReq();
    const res = mockRes();

    errorHandler(new NotFoundError('invalid_credentials'), req, res, jest.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'invalid_credentials', requestId: 'req-1' },
    });
  });

  it('maps an authorization ForbiddenError to 403', () => {
    const req = mockReq();
    const res = mockRes();

    errorHandler(new ForbiddenError('actor_not_admin'), req, res, jest.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it.each([
    'invalid_credentials',
    'invalid_token',
    'token_reuse_detected',
    'session_not_found',
    'token_version_mismatch',
    'user_not_found_or_inactive',
    'invalid_current_password',
  ])('maps an authentication ForbiddenError("%s") to 401', (message) => {
    const req = mockReq();
    const res = mockRes();

    errorHandler(new ForbiddenError(message), req, res, jest.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('maps a ZodError to 422 with formatted field details', () => {
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse({ email: 'nope' });
    const req = mockReq();
    const res = mockRes();

    errorHandler(result.error as ZodError, req, res, jest.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(422);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details[0]).toEqual(expect.objectContaining({ path: 'email' }));
  });

  it('maps a bare-string Result failure to 500 and preserves the message', () => {
    const req = mockReq();
    const res = mockRes();

    errorHandler('something went wrong', req, res, jest.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.message).toBe('something went wrong');
    expect(body.error.requestId).toBe('req-1');
  });

  it('maps a base DomainError / unknown error to 500', () => {
    const req = mockReq();
    const res = mockRes();

    errorHandler(new DomainError('boom'), req, res, jest.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('hides the error message in production for 500-level errors', () => {
    process.env.NODE_ENV = 'production';
    const req = mockReq();
    const res = mockRes();

    errorHandler(new Error('stack trace details'), req, res, jest.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.message).not.toContain('stack trace details');
  });

  it('includes details on a DomainError when present', () => {
    const req = mockReq();
    const res = mockRes();

    errorHandler(new ValidationError('bad_input', { field: 'email' }), req, res, jest.fn() as NextFunction);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.details).toEqual({ field: 'email' });
  });
});
