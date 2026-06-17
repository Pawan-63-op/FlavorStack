import {
  sessionKey,
  sessionIndexKey,
  otpKey,
  otpAttemptsKey,
  rateLimitKey,
  cacheKey,
} from '../../../../infrastructure/redis/keys';

describe('redis keys', () => {
  it('builds session keys', () => {
    expect(sessionKey('user-1', 'session-1')).toBe('session:user-1:session-1');
  });

  it('builds session index keys', () => {
    expect(sessionIndexKey('user-1')).toBe('session:index:user-1');
  });

  it('builds OTP keys from an opaque key', () => {
    expect(otpKey('email-verify:user-1')).toBe('otp:email-verify:user-1');
    expect(otpKey('password-reset:user-1')).toBe('otp:password-reset:user-1');
    expect(otpKey('phone-verify:user-1')).toBe('otp:phone-verify:user-1');
  });

  it('builds OTP attempt-counter keys from the same opaque key', () => {
    expect(otpAttemptsKey('email-verify:user-1')).toBe('rate:otp:email-verify:user-1');
  });

  it('builds rate-limit keys from action and identifier', () => {
    expect(rateLimitKey('login', 'user-1')).toBe('rate:login:user-1');
    expect(rateLimitKey('otp-generation', 'user@example.com')).toBe('rate:otp-generation:user@example.com');
  });

  it('builds cache keys from namespace and id', () => {
    expect(cacheKey('restaurant', 'restaurant-1')).toBe('cache:restaurant:restaurant-1');
  });
});
