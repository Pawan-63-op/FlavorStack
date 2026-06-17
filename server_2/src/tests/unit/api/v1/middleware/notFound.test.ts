import { Request, Response, NextFunction } from 'express';
import { notFound } from '../../../../../api/v1/middleware/notFound';
import { NotFoundError } from '../../../../../domain/shared/errors/NotFoundError';

describe('notFound middleware', () => {
  it('forwards a NotFoundError describing the unmatched route', () => {
    const req = { method: 'GET', originalUrl: '/api/v1/unknown' } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    notFound(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
    const err = next.mock.calls[0][0] as NotFoundError;
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toContain('GET');
    expect(err.message).toContain('/api/v1/unknown');
  });
});
