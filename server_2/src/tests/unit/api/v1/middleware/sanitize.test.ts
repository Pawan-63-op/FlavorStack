import { Request, Response, NextFunction } from 'express';
import { sanitize } from '../../../../../api/v1/middleware/sanitize';

function mockReqRes(body: unknown = {}, query: unknown = {}, params: unknown = {}) {
  const req = { body, query, params } as unknown as Request;
  const res = {} as Response;
  const next = jest.fn();
  return { req, res, next };
}

describe('sanitize middleware', () => {
  it('strips keys starting with $ (NoSQL operator injection) from the body', () => {
    const { req, res, next } = mockReqRes({ email: 'a@b.com', $where: 'this.password' });

    sanitize(req, res, next as NextFunction);

    expect(req.body).toEqual({ email: 'a@b.com' });
    expect(next).toHaveBeenCalledWith();
  });

  it('strips keys containing dots (nested-path injection) from the body', () => {
    const { req, res, next } = mockReqRes({ 'profile.role': 'admin', name: 'Bob' });

    sanitize(req, res, next as NextFunction);

    expect(req.body).toEqual({ name: 'Bob' });
  });

  it('strips HTML tags from string values', () => {
    const { req, res, next } = mockReqRes({ bio: '<script>alert(1)</script>Hello' });

    sanitize(req, res, next as NextFunction);

    expect((req.body as { bio: string }).bio).toBe('alert(1)Hello');
  });

  it('recursively sanitizes nested objects and arrays', () => {
    const { req, res, next } = mockReqRes({
      address: { city: '<b>NYC</b>', $gt: 1 },
      tags: ['<i>fresh</i>', 'organic'],
    });

    sanitize(req, res, next as NextFunction);

    expect(req.body).toEqual({ address: { city: 'NYC' }, tags: ['fresh', 'organic'] });
  });

  it('sanitizes query and params in addition to the body', () => {
    const { req, res, next } = mockReqRes({}, { $where: '1' }, { id: '<b>1</b>' });

    sanitize(req, res, next as NextFunction);

    expect(req.query).toEqual({});
    expect(req.params).toEqual({ id: '1' });
  });
});
