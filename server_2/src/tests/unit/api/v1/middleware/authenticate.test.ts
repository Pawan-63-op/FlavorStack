import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../../../api/v1/middleware/authenticate';
import { ACCESS_TOKEN_COOKIE } from '../../../../../api/v1/http/cookies';
import { FakeTokenService } from '../../../../mocks/identity.mocks';
import { Result } from '../../../../../domain/shared/Result';
import { ForbiddenError } from '../../../../../domain/shared/errors/ForbiddenError';
import { TokenPayLoad } from '../../../../../domain/identity/value-objects/TokenPayLoad.vo';
import { USER_ROLE } from '../../../../../domain/identity/enums/user-role.enum';

function mockRes(): Response {
  return {} as Response;
}

const PAYLOAD: TokenPayLoad = {
  userId: 'user-1',
  role: USER_ROLE.CUSTOMER,
  sessionId: 'session-1',
  jti: 'jti-1',
  tokenVersion: 0,
  iat: 0,
  exp: 0,
};

describe('authenticate middleware', () => {
  let tokenService: FakeTokenService;

  beforeEach(() => {
    tokenService = new FakeTokenService();
  });

  it('attaches req.user from a valid access_token cookie', () => {
    const token = tokenService.generateAccessToken(PAYLOAD);
    const req = { cookies: { [ACCESS_TOKEN_COOKIE]: token }, headers: {} } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    authenticate(tokenService)(req, res, next as NextFunction);

    expect(req.user).toEqual({
      userId: 'user-1',
      role: USER_ROLE.CUSTOMER,
      sessionId: 'session-1',
      jti: 'jti-1',
      tokenVersion: 0,
    });
    expect(next).toHaveBeenCalledWith();
  });

  it('falls back to the Authorization Bearer header when no cookie is present', () => {
    const token = tokenService.generateAccessToken(PAYLOAD);
    const req = { cookies: {}, headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    authenticate(tokenService)(req, res, next as NextFunction);

    expect(req.user?.userId).toBe('user-1');
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with a ForbiddenError("invalid_token") when no token is present', () => {
    const req = { cookies: {}, headers: {} } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    authenticate(tokenService)(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    const err = next.mock.calls[0][0] as ForbiddenError;
    expect(err.message).toBe('invalid_token');
  });

  it('calls next with a ForbiddenError("invalid_token") when the token is malformed', () => {
    const req = { cookies: { [ACCESS_TOKEN_COOKIE]: 'garbage' }, headers: {} } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    authenticate(tokenService)(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect((next.mock.calls[0][0] as ForbiddenError).message).toBe('invalid_token');
  });

  it('normalizes an expired-token failure to ForbiddenError("invalid_token")', () => {
    tokenService.setVerifyResult(Result.fail('token_expired'));
    const req = { cookies: { [ACCESS_TOKEN_COOKIE]: 'expired-token' }, headers: {} } as unknown as Request;
    const res = mockRes();
    const next = jest.fn();

    authenticate(tokenService)(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect((next.mock.calls[0][0] as ForbiddenError).message).toBe('invalid_token');
  });
});
