import { assertRequiredConfig } from '../../../config/index';

describe('assertRequiredConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws when JWT_PRIVATE_KEY, JWT_PUBLIC_KEY and RESEND_API_KEY are missing', () => {
    delete process.env.JWT_PRIVATE_KEY;
    delete process.env.JWT_PRIVATE_KEY_PATH;
    delete process.env.JWT_PUBLIC_KEY;
    delete process.env.JWT_PUBLIC_KEY_PATH;
    delete process.env.RESEND_API_KEY;

    expect(() => assertRequiredConfig()).toThrow(
      /JWT_PRIVATE_KEY.*JWT_PUBLIC_KEY.*RESEND_API_KEY/s,
    );
  });

  it('does not throw when all required env vars are present', () => {
    process.env.JWT_PRIVATE_KEY = 'private-key';
    process.env.JWT_PUBLIC_KEY = 'public-key';
    process.env.RESEND_API_KEY = 'resend-secret';

    expect(() => assertRequiredConfig()).not.toThrow();
  });

  it('lists only the missing variables', () => {
    process.env.JWT_PRIVATE_KEY = 'private-key';
    process.env.JWT_PUBLIC_KEY = 'public-key';
    delete process.env.RESEND_API_KEY;

    expect(() => assertRequiredConfig()).toThrow(/RESEND_API_KEY/);
    try {
      assertRequiredConfig();
    } catch (e) {
      expect((e as Error).message).not.toMatch(/JWT_PRIVATE_KEY/);
      expect((e as Error).message).not.toMatch(/JWT_PUBLIC_KEY/);
    }
  });
});
