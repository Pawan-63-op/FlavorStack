import { getEmailConfig } from '../../../config/email';

describe('getEmailConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns sensible defaults when no env vars are set', () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.APP_BASE_URL;

    expect(getEmailConfig()).toEqual({
      apiKey: '',
      from: 'no-reply@flavorstack.app',
      appBaseUrl: 'http://localhost:3000',
    });
  });

  it('reads overrides from environment variables', () => {
    process.env.RESEND_API_KEY = 'resend-secret';
    process.env.EMAIL_FROM = 'hello@flavorstack.app';
    process.env.APP_BASE_URL = 'https://flavorstack.app';

    expect(getEmailConfig()).toEqual({
      apiKey: 'resend-secret',
      from: 'hello@flavorstack.app',
      appBaseUrl: 'https://flavorstack.app',
    });
  });
});
