import { Request, Response, NextFunction } from 'express';
import { requireIdempotencyKey } from '../../../../../api/v1/middleware/idempotency';
import { ValidationError } from '../../../../../domain/shared/errors/ValidationError';

function mockReq(headerValue?: string): Request {
  return {
    header: (name: string): string | undefined =>
      name.toLowerCase() === 'idempotency-key' ? headerValue : undefined,
  } as unknown as Request;
}

const KEY = '11111111-1111-1111-1111-111111111111';

describe('requireIdempotencyKey middleware', () => {
  it('attaches a well-formed Idempotency-Key to the request and calls next()', () => {
    const req = mockReq(KEY);
    const next = jest.fn();

    requireIdempotencyKey(req, {} as Response, next as NextFunction);

    expect(req.idempotencyKey).toBe(KEY);
    expect(next).toHaveBeenCalledWith();
  });

  it('canonicalizes a mixed-case / padded key to its trimmed lower-case form', () => {
    const req = mockReq(`  ${KEY.toUpperCase()}  `);
    const next = jest.fn();

    requireIdempotencyKey(req, {} as Response, next as NextFunction);

    expect(req.idempotencyKey).toBe(KEY);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a missing header with a ValidationError and attaches nothing', () => {
    const req = mockReq(undefined);
    const next = jest.fn();

    requireIdempotencyKey(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    expect(req.idempotencyKey).toBeUndefined();
  });

  it('rejects a malformed (non-UUID) header with a ValidationError', () => {
    const req = mockReq('not-a-uuid');
    const next = jest.fn();

    requireIdempotencyKey(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    expect(req.idempotencyKey).toBeUndefined();
  });
});
