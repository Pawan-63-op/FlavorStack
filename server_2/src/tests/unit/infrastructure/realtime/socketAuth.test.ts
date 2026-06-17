// Unit tests for the Socket.IO handshake JWT guard (Phase 7).
import type { Socket } from 'socket.io';
import { socketAuth } from '../../../../infrastructure/realtime/middleware/socketAuth';
import { ITokenService } from '../../../../domain/identity/services/ITokenService';
import { Result } from '../../../../domain/shared/Result';
import { TokenPayLoad } from '../../../../domain/identity/value-objects/TokenPayLoad.vo';
import { USER_ROLE } from '../../../../domain/identity/enums/user-role.enum';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';

const PAYLOAD: TokenPayLoad = {
  userId: 'user-1',
  role: USER_ROLE.DRIVER,
  sessionId: 'sess-1',
  jti: 'jti-1',
  tokenVersion: 1,
  iat: 0,
  exp: 0,
};

function makeTokenService(ok: boolean): jest.Mocked<ITokenService> {
  return {
    generateAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    decode: jest.fn(),
    verify: jest.fn().mockReturnValue(ok ? Result.ok(PAYLOAD) : Result.fail(new ForbiddenError('invalid'))),
  } as unknown as jest.Mocked<ITokenService>;
}

function makeSocket(handshake: Record<string, unknown>): Socket {
  return { handshake: { auth: {}, headers: {}, query: {}, ...handshake }, data: {} } as unknown as Socket;
}

describe('socketAuth', () => {
  it('accepts a valid token from handshake.auth and attaches the user', () => {
    const tokenService = makeTokenService(true);
    const socket = makeSocket({ auth: { token: 'good' } });
    const next = jest.fn();

    socketAuth(tokenService)(socket, next);

    expect(tokenService.verify).toHaveBeenCalledWith('good');
    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user).toMatchObject({ userId: 'user-1', role: USER_ROLE.DRIVER });
  });

  it('accepts a Bearer token from the Authorization header', () => {
    const tokenService = makeTokenService(true);
    const socket = makeSocket({ headers: { authorization: 'Bearer hdr-token' } });
    const next = jest.fn();

    socketAuth(tokenService)(socket, next);

    expect(tokenService.verify).toHaveBeenCalledWith('hdr-token');
    expect(next).toHaveBeenCalledWith();
  });

  it('accepts a token from the access_token cookie', () => {
    const tokenService = makeTokenService(true);
    const socket = makeSocket({ headers: { cookie: 'foo=bar; access_token=cookie-token; baz=1' } });
    const next = jest.fn();

    socketAuth(tokenService)(socket, next);

    expect(tokenService.verify).toHaveBeenCalledWith('cookie-token');
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects when no token is present', () => {
    const tokenService = makeTokenService(true);
    const socket = makeSocket({});
    const next = jest.fn();

    socketAuth(tokenService)(socket, next);

    expect(tokenService.verify).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('rejects when the token fails verification', () => {
    const tokenService = makeTokenService(false);
    const socket = makeSocket({ auth: { token: 'bad' } });
    const next = jest.fn();

    socketAuth(tokenService)(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(socket.data.user).toBeUndefined();
  });
});
