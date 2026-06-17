import { getCorsOptions } from '../../../config/cors';

type OriginCallback = (err: Error | null, allow?: boolean) => void;

function callOrigin(origin: string | undefined): { err: Error | null; allow?: boolean } {
  const options = getCorsOptions();
  let captured: { err: Error | null; allow?: boolean } = { err: null };
  const callback: OriginCallback = (err, allow) => {
    captured = { err, allow };
  };
  (options.origin as (origin: string | undefined, cb: OriginCallback) => void)(origin, callback);
  return captured;
}

describe('getCorsOptions', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows requests with no origin (server-to-server / curl)', () => {
    process.env.ALLOWED_ORIGINS = 'https://app.flavorstack.com';

    const result = callOrigin(undefined);

    expect(result.err).toBeNull();
    expect(result.allow).toBe(true);
  });

  it('allows an origin present in ALLOWED_ORIGINS', () => {
    process.env.ALLOWED_ORIGINS = 'https://app.flavorstack.com,https://admin.flavorstack.com';

    const result = callOrigin('https://admin.flavorstack.com');

    expect(result.err).toBeNull();
    expect(result.allow).toBe(true);
  });

  it('rejects an origin not present in ALLOWED_ORIGINS', () => {
    process.env.ALLOWED_ORIGINS = 'https://app.flavorstack.com';

    const result = callOrigin('https://evil.example');

    expect(result.err).toBeInstanceOf(Error);
    expect(result.allow).toBeUndefined();
  });

  it('falls back to the local dev origin when ALLOWED_ORIGINS is unset', () => {
    delete process.env.ALLOWED_ORIGINS;

    const result = callOrigin('http://localhost:3000');

    expect(result.err).toBeNull();
    expect(result.allow).toBe(true);
  });

  it('enables credentials so auth cookies are sent cross-origin', () => {
    const options = getCorsOptions();

    expect(options.credentials).toBe(true);
  });
});
