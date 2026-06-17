import { z, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { validate } from '../../../../../api/v1/middleware/validate';

describe('validate middleware', () => {
  const bodySchema = z.object({ email: z.string().email(), age: z.coerce.number().optional() });

  it('overwrites req.body with the parsed/coerced value on success', () => {
    const req = { body: { email: 'a@b.com', age: '30' } } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    validate(bodySchema)(req, res, next as NextFunction);

    expect(req.body).toEqual({ email: 'a@b.com', age: 30 });
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with a ZodError and leaves req.body untouched on failure', () => {
    const original = { email: 'not-an-email' };
    const req = { body: original } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    validate(bodySchema)(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ZodError));
    expect(req.body).toBe(original);
  });

  it('validates req.params when target is "params"', () => {
    const paramsSchema = z.object({ id: z.string().min(1) });
    const req = { params: { id: 'abc' } } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    validate(paramsSchema, 'params')(req, res, next as NextFunction);

    expect(req.params).toEqual({ id: 'abc' });
    expect(next).toHaveBeenCalledWith();
  });

  it('validates and coerces req.query when target is "query"', () => {
    const querySchema = z.object({ page: z.coerce.number().default(1) });
    const req = { query: {} } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    validate(querySchema, 'query')(req, res, next as NextFunction);

    expect(req.query).toEqual({ page: 1 });
    expect(next).toHaveBeenCalledWith();
  });
});
