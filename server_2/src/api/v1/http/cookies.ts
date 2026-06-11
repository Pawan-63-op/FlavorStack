// Set/clear the access_token and refresh_token auth cookies
import { CookieOptions, Response } from 'express';
import { getAuthConfig } from '../../../config/auth';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
const REFRESH_TOKEN_PATH = '/api/v1/auth/refresh';

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const { accessTtlSeconds, refreshTtlSeconds } = getAuthConfig();

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseCookieOptions(),
    path: '/',
    maxAge: accessTtlSeconds * 1000,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    path: REFRESH_TOKEN_PATH,
    maxAge: refreshTtlSeconds * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...baseCookieOptions(), path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...baseCookieOptions(), path: REFRESH_TOKEN_PATH });
}
