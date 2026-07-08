import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { type Page } from "@playwright/test";

const exec = promisify(execFile);

/**
 * server_2 issues OTPs into Redis (`otp:<purpose>:<userId>`) *before* attempting
 * delivery — and local delivery is a placeholder (the Resend key is invalid, so
 * `email-otp/send` even returns 500). The E2E therefore reads the real code
 * straight from Redis instead of an inbox. Keys/TTLs: see server_2
 * `src/application/identity/otp-keys.ts` + `redis/keys.ts`.
 */
export type OtpPurpose = "email-verify" | "phone-verify" | "password-reset";

/** Redis container running server_2's Redis (compose default name). */
const REDIS_CONTAINER = process.env.E2E_REDIS_CONTAINER ?? "server_2-redis-1";

async function redisGet(key: string): Promise<string | null> {
  const { stdout } = await exec("docker", [
    "exec",
    REDIS_CONTAINER,
    "redis-cli",
    "GET",
    key,
  ]);
  const value = stdout.trim();
  return value.length > 0 ? value : null;
}

/**
 * Poll Redis for the 6-digit OTP a `send` just issued. Short poll because the
 * code is written around the same time the HTTP response lands.
 */
export async function readOtp(
  purpose: OtpPurpose,
  userId: string,
  { tries = 12, intervalMs = 500 }: { tries?: number; intervalMs?: number } = {},
): Promise<string> {
  const key = `otp:${purpose}:${userId}`;
  for (let attempt = 0; attempt < tries; attempt++) {
    const code = await redisGet(key);
    if (code && /^\d{6}$/.test(code)) return code;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`OTP not found in Redis at ${key} after ${tries} tries`);
}

/** Type a 6-digit code into the shadcn `InputOTP` (single underlying input). */
export async function fillOtp(page: Page, code: string): Promise<void> {
  const input = page.locator('input[data-slot="input-otp"]');
  await input.click();
  await input.fill(code);
}

/**
 * Clear server_2's IP-keyed rate-limit buckets (`rate:login:*`,
 * `rate:password-reset:*`). These are keyed by the shared docker-gateway IP, so
 * they accumulate across tests/runs (login 5/15min, password-reset 3/hr) and
 * would otherwise trip. OTP-generation/verification are user-keyed (fresh user
 * per run) so they need no cleanup. Run before each test for determinism.
 */
export async function flushRateLimits(): Promise<void> {
  const cmd =
    "for p in 'rate:login:*' 'rate:password-reset:*'; do " +
    'redis-cli --scan --pattern "$p" | xargs -r redis-cli DEL; done';
  await exec("docker", ["exec", REDIS_CONTAINER, "sh", "-c", cmd]);
}
