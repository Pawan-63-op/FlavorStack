// Centralized Redis key builders — pure, side-effect-free prefix conventions
// shared by SessionStore, OtpStore, CacheStore, and RateLimiter.

/** `session:{userId}:{sessionId}` — session payload. */
export function sessionKey(userId: string, sessionId: string): string {
  return `session:${userId}:${sessionId}`;
}

/** `session:index:{userId}` — Set of a user's sessionIds. */
export function sessionIndexKey(userId: string): string {
  return `session:index:${userId}`;
}

/** `otp:{key}` — OTP code, where `key` is an opaque key from `otp-keys.ts`. */
export function otpKey(key: string): string {
  return `otp:${key}`;
}

/** `rate:otp:{key}` — OTP failed-attempt counter, keyed by the same opaque key. */
export function otpAttemptsKey(key: string): string {
  return `rate:otp:${key}`;
}

/** `rate:{action}:{identifier}` — sliding-window rate-limit sorted set. */
export function rateLimitKey(action: string, identifier: string): string {
  return `rate:${action}:${identifier}`;
}

/** `cache:{namespace}:{id}` — generic cache entry. */
export function cacheKey(namespace: string, id: string): string {
  return `cache:${namespace}:${id}`;
}
