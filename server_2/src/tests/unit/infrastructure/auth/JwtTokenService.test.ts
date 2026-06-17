import { generateKeyPairSync } from 'crypto';
import jwt from 'jsonwebtoken';
import { JwtTokenService } from '../../../../infrastructure/auth/JwtTokenService';
import { TokenPayLoad } from '../../../../domain/identity/value-objects/TokenPayLoad.vo';
import { USER_ROLE } from '../../../../domain/identity/enums/user-role.enum';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const ISSUER = 'flavorstack';
const AUDIENCE = 'flavorstack-clients';
const ACCESS_TTL = 900;
const REFRESH_TTL = 2592000;

function makeService(overrides: Partial<{
  privateKey: string;
  publicKey: string;
  accessTtl: number;
  refreshTtl: number;
  issuer: string;
  audience: string;
}> = {}): JwtTokenService {
  return new JwtTokenService({
    privateKey,
    publicKey,
    accessTtl: ACCESS_TTL,
    refreshTtl: REFRESH_TTL,
    issuer: ISSUER,
    audience: AUDIENCE,
    ...overrides,
  });
}

function basePayload(): TokenPayLoad {
  const now = Math.floor(Date.now() / 1000);
  return {
    userId: 'user-1',
    role: USER_ROLE.CUSTOMER,
    sessionId: 'session-1',
    jti: 'jti-1',
    tokenVersion: 3,
    iat: now,
    exp: now + ACCESS_TTL,
  };
}

describe('JwtTokenService', () => {
  it('signs an access token that verifies and round-trips the claims', () => {
    const service = makeService();
    const payload = basePayload();

    const token = service.generateAccessToken(payload);
    const result = service.verify(token);

    expect(result.isSuccess).toBe(true);
    const verified = result.getValue();
    expect(verified.userId).toBe('user-1');
    expect(verified.role).toBe(USER_ROLE.CUSTOMER);
    expect(verified.sessionId).toBe('session-1');
    expect(verified.jti).toBe('jti-1');
    expect(verified.tokenVersion).toBe(3);
  });

  it('signs a refresh token that verifies and round-trips the claims', () => {
    const service = makeService();

    const token = service.generateRefreshToken(basePayload());
    const result = service.verify(token);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().jti).toBe('jti-1');
  });

  it('sets exp from the configured access TTL (~now + 900s)', () => {
    const service = makeService();
    const before = Math.floor(Date.now() / 1000);

    const token = service.generateAccessToken(basePayload());
    const decoded = jwt.decode(token) as { iat: number; exp: number };

    expect(decoded.exp - decoded.iat).toBe(ACCESS_TTL);
    expect(decoded.exp).toBeGreaterThanOrEqual(before + ACCESS_TTL - 2);
  });

  it('gives the refresh token a longer TTL than the access token', () => {
    const service = makeService();

    const access = jwt.decode(service.generateAccessToken(basePayload())) as { iat: number; exp: number };
    const refresh = jwt.decode(service.generateRefreshToken(basePayload())) as { iat: number; exp: number };

    expect(access.exp - access.iat).toBe(ACCESS_TTL);
    expect(refresh.exp - refresh.iat).toBe(REFRESH_TTL);
    expect(refresh.exp - refresh.iat).toBeGreaterThan(access.exp - access.iat);
  });

  it('does not pass a caller-supplied exp into jwt.sign (no "Bad options" throw)', () => {
    const service = makeService();
    const payload = { ...basePayload(), iat: 0, exp: 0 };

    expect(() => service.generateAccessToken(payload)).not.toThrow();
  });

  it('fails with token_expired for an expired token', () => {
    const service = makeService({ accessTtl: -10 });

    const token = service.generateAccessToken(basePayload());
    const result = service.verify(token);

    expect(result.isFailure).toBe(true);
    expect(String(result.getError())).toContain('token_expired');
  });

  it('fails with invalid_token for a tampered signature', () => {
    const service = makeService();
    const token = service.generateAccessToken(basePayload());
    const tampered = token.slice(0, -3) + (token.endsWith('aaa') ? 'bbb' : 'aaa');

    const result = service.verify(tampered);

    expect(result.isFailure).toBe(true);
    expect(String(result.getError())).toContain('invalid_token');
  });

  it('fails with invalid_token when verified against a different public key', () => {
    const other = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const signer = makeService();
    const verifier = makeService({ publicKey: other.publicKey });

    const token = signer.generateAccessToken(basePayload());
    const result = verifier.verify(token);

    expect(result.isFailure).toBe(true);
    expect(String(result.getError())).toContain('invalid_token');
  });

  it('rejects an alg:none token (no algorithm confusion)', () => {
    const service = makeService();
    const forged = jwt.sign({ userId: 'attacker' }, '', {
      algorithm: 'none',
      issuer: ISSUER,
      audience: AUDIENCE,
    } as jwt.SignOptions);

    const result = service.verify(forged);

    expect(result.isFailure).toBe(true);
    expect(String(result.getError())).toContain('invalid_token');
  });

  it('rejects an HS256 token signed with the public key as the secret', () => {
    const service = makeService();
    const forged = jwt.sign({ userId: 'attacker' }, publicKey, {
      algorithm: 'HS256',
      issuer: ISSUER,
      audience: AUDIENCE,
    });

    const result = service.verify(forged);

    expect(result.isFailure).toBe(true);
    expect(String(result.getError())).toContain('invalid_token');
  });

  it('rejects a token with the wrong issuer/audience', () => {
    const signer = makeService({ issuer: 'evil', audience: 'evil-clients' });
    const verifier = makeService();

    const token = signer.generateAccessToken(basePayload());
    const result = verifier.verify(token);

    expect(result.isFailure).toBe(true);
    expect(String(result.getError())).toContain('invalid_token');
  });

  it('decode returns the claims without verifying the signature', () => {
    const service = makeService();
    const token = service.generateAccessToken(basePayload());
    const tampered = token.slice(0, -3) + 'zzz';

    const decoded = service.decode(tampered);

    expect(decoded).not.toBeNull();
    expect(decoded!.userId).toBe('user-1');
    expect(decoded!.tokenVersion).toBe(3);
  });

  it('decode returns null for a garbage token', () => {
    const service = makeService();

    expect(service.decode('not-a-jwt')).toBeNull();
  });
});
