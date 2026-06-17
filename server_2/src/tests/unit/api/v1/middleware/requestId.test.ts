import { Request, Response, NextFunction } from 'express';
import { requestId } from '../../../../../api/v1/middleware/requestId';

function mockReq(headers: Record<string, string> = {}): Request {
  return {
    headers,
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
}

function mockRes(): Response {
  return { setHeader: jest.fn() } as unknown as Response;
}

describe('requestId middleware', () => {
  it('generates a request id and attaches request context', () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    requestId(req, res, next as NextFunction);

    expect(typeof req.context.requestId).toBe('string');
    expect(req.context.requestId.length).toBeGreaterThan(0);
    expect(next).toHaveBeenCalledWith();
  });

  it('honors an inbound x-request-id header instead of generating a new one', () => {
    const req = mockReq({ 'x-request-id': 'inbound-id' });
    const res = mockRes();
    const next = jest.fn();

    requestId(req, res, next as NextFunction);

    expect(req.context.requestId).toBe('inbound-id');
  });

  it('echoes the request id back on the response header', () => {
    const req = mockReq({ 'x-request-id': 'inbound-id' });
    const res = mockRes();
    const next = jest.fn();

    requestId(req, res, next as NextFunction);

    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'inbound-id');
  });

  it('captures ip and user-agent on req.context', () => {
    const req = mockReq({ 'user-agent': 'jest-agent' });
    const res = mockRes();
    const next = jest.fn();

    requestId(req, res, next as NextFunction);

    expect(req.context.ip).toBe('127.0.0.1');
    expect(req.context.userAgent).toBe('jest-agent');
  });

  it('generates two different ids for two requests with no header', () => {
    const reqA = mockReq();
    const reqB = mockReq();
    const res = mockRes();
    const next = jest.fn();

    requestId(reqA, res, next as NextFunction);
    requestId(reqB, res, next as NextFunction);

    expect(reqA.context.requestId).not.toBe(reqB.context.requestId);
  });
});
