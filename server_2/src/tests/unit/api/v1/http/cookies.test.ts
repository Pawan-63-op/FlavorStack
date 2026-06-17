import { Response } from 'express';
import { setAuthCookies, clearAuthCookies } from '../../../../../api/v1/http/cookies';

function mockResponse(): Response {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;
}

describe('cookies', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('setAuthCookies', () => {
    it('sets access_token as HttpOnly, SameSite=Lax, path=/, with the access TTL maxAge', () => {
      const res = mockResponse();

      setAuthCookies(res, 'access-jwt', 'refresh-jwt');

      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'access-jwt',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: false,
          maxAge: 900 * 1000,
        }),
      );
    });

    it('sets refresh_token scoped to the refresh path with the refresh TTL maxAge', () => {
      const res = mockResponse();

      setAuthCookies(res, 'access-jwt', 'refresh-jwt');

      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh-jwt',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/api/v1/auth/refresh',
          secure: false,
          maxAge: 2592000 * 1000,
        }),
      );
    });

    it('marks both cookies Secure when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      const res = mockResponse();

      setAuthCookies(res, 'access-jwt', 'refresh-jwt');

      expect(res.cookie).toHaveBeenCalledWith('access_token', 'access-jwt', expect.objectContaining({ secure: true }));
      expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'refresh-jwt', expect.objectContaining({ secure: true }));
    });
  });

  describe('clearAuthCookies', () => {
    it('clears access_token and refresh_token with their matching paths', () => {
      const res = mockResponse();

      clearAuthCookies(res);

      expect(res.clearCookie).toHaveBeenCalledWith('access_token', expect.objectContaining({ path: '/' }));
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({ path: '/api/v1/auth/refresh' }),
      );
    });
  });
});
