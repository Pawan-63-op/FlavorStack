import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';
import { audit } from '../../../../../api/v1/middleware/audit';

jest.mock('../../../../../infrastructure/observability/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

import { logger } from '../../../../../infrastructure/observability/logger';

function mockRes(statusCode = 204): Response {
  const res = new EventEmitter() as unknown as Response;
  (res as unknown as { statusCode: number }).statusCode = statusCode;
  return res;
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    context: { requestId: 'req-1', ip: '1.2.3.4' },
    params: {},
    ...overrides,
  } as unknown as Request;
}

describe('audit middleware', () => {
  it('calls next() immediately without waiting for the response to finish', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    audit('login')(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('logs a structured audit record once the response finishes', () => {
    const req = mockReq({
      user: { userId: 'user-1', role: 'CUSTOMER', sessionId: 's1', jti: 'j1', tokenVersion: 0 } as any,
      params: { userId: 'target-1' },
    });
    const res = mockRes(204);
    const next = jest.fn();

    audit('ban-user')(req, res, next as NextFunction);
    res.emit('finish');

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ban-user',
        actorId: 'user-1',
        status: 204,
        requestId: 'req-1',
        target: { userId: 'target-1' },
      }),
      expect.any(String),
    );
  });

  it('omits actorId for unauthenticated requests', () => {
    const req = mockReq();
    const res = mockRes(201);
    const next = jest.fn();

    audit('register')(req, res, next as NextFunction);
    res.emit('finish');

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'register', actorId: undefined, status: 201 }),
      expect.any(String),
    );
  });

  it('never throws even if the logger fails', () => {
    (logger.info as jest.Mock).mockImplementation(() => {
      throw new Error('logger exploded');
    });
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    audit('login')(req, res, next as NextFunction);

    expect(() => res.emit('finish')).not.toThrow();
    expect(logger.warn).toHaveBeenCalled();
  });
});
