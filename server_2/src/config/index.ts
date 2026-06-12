// Re-exports config modules and asserts required env vars at startup (fail-fast)
import { getAuthConfig } from './auth';
import { getEmailConfig } from './email';

export * from './auth';
export * from './email';
export * from './outbox';

export function assertRequiredConfig(): void {
  const auth = getAuthConfig();
  const email = getEmailConfig();
  const missing: string[] = [];

  if (!auth.jwtPrivateKey) missing.push('JWT_PRIVATE_KEY (or JWT_PRIVATE_KEY_PATH)');
  if (!auth.jwtPublicKey) missing.push('JWT_PUBLIC_KEY (or JWT_PUBLIC_KEY_PATH)');
  if (!email.apiKey) missing.push('RESEND_API_KEY');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
