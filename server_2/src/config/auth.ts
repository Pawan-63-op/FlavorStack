import { readFileSync } from 'fs';

export interface AuthConfig {
  jwtPrivateKey: string;
  jwtPublicKey: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  issuer: string;
  audience: string;
  bcryptRounds: number;
  otpLength: number;
}

function resolveKey(envValue: string | undefined, pathValue: string | undefined): string {
  if (envValue) return envValue.replace(/\\n/g, '\n');
  if (pathValue) return readFileSync(pathValue, 'utf-8');
  return '';
}

export function getAuthConfig(): AuthConfig {
  return {
    jwtPrivateKey: resolveKey(process.env.JWT_PRIVATE_KEY, process.env.JWT_PRIVATE_KEY_PATH),
    jwtPublicKey: resolveKey(process.env.JWT_PUBLIC_KEY, process.env.JWT_PUBLIC_KEY_PATH),
    accessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
    refreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 2592000),
    issuer: process.env.JWT_ISSUER ?? 'flavorstack',
    audience: process.env.JWT_AUDIENCE ?? 'flavorstack-clients',
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
    otpLength: Number(process.env.OTP_LENGTH ?? 6),
  };
}
