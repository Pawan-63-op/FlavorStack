import { randomUUID } from 'crypto';
import { RedisClient } from './client';
import { rateLimitKey } from './keys';
import { SLIDING_WINDOW_SCRIPT } from './scripts/slidingWindow';

/** Actions with a configured rate-limit rule. */
export type RateLimitAction =
  | 'login'
  | 'otp-generation'
  | 'otp-verification'
  | 'password-reset'
  | 'catalog-search';

/** A single sliding-window rule: at most `max` requests per `windowSeconds`. */
export interface RateLimitRule {
  windowSeconds: number;
  max: number;
}

/** Result of a rate-limit check, shaped for `429` + `Retry-After` middleware. */
export interface RateLimitResult {
  /** Whether this request is permitted. */
  allowed: boolean;
  /** Requests left in the current window after this call (0 when blocked). */
  remaining: number;
  /** Seconds until the window frees up (0 when allowed). */
  retryAfter: number;
}

/**
 * Reads `RATE_LIMIT_<ACTION>_MAX` / `_WINDOW_SECONDS` (action upper-snake-cased), falling back
 * to the built-in rule. Deployments differ in how many callers share an address — a public demo
 * where one visitor legitimately signs in as four different roles needs a looser login rule than
 * a real tenant — and that is a deployment decision, not a code change.
 */
function rule(action: RateLimitAction, windowSeconds: number, max: number): RateLimitRule {
  const key = action.toUpperCase().replace(/-/g, '_');
  const envWindow = Number(process.env[`RATE_LIMIT_${key}_WINDOW_SECONDS`]);
  const envMax = Number(process.env[`RATE_LIMIT_${key}_MAX`]);
  return {
    windowSeconds: Number.isFinite(envWindow) && envWindow > 0 ? envWindow : windowSeconds,
    max: Number.isFinite(envMax) && envMax > 0 ? envMax : max,
  };
}

/** Default per-action rules; override via the constructor for tests or tuning. */
export const DEFAULT_RATE_LIMITS: Record<RateLimitAction, RateLimitRule> = {
  login: rule('login', 900, 5),
  'otp-generation': rule('otp-generation', 600, 3),
  'otp-verification': rule('otp-verification', 600, 5),
  'password-reset': rule('password-reset', 3600, 3),
  'catalog-search': rule('catalog-search', 60, 60),
};

export class RateLimiter {
  private readonly rules: Record<RateLimitAction, RateLimitRule>;

  constructor(
    private readonly redisClient: RedisClient,
    rules: Record<RateLimitAction, RateLimitRule> = DEFAULT_RATE_LIMITS,
  ) {
    this.rules = rules;
  }

  /**
   * Records a request for `{action, identifier}` and reports whether it is within
   * the configured limit. `identifier` is userId / email / IP, per the action.
   */
  async check(action: RateLimitAction, identifier: string): Promise<RateLimitResult> {
    const rule = this.rules[action];
    const now = Date.now();
    const windowMs = rule.windowSeconds * 1000;
    const member = `${now}-${randomUUID()}`;

    const [allowed, remaining, retryAfter] = (await this.redisClient
      .getClient()
      .eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        rateLimitKey(action, identifier),
        now,
        windowMs,
        rule.max,
        rule.windowSeconds,
        member,
      )) as [number, number, number];

    return {
      allowed: allowed === 1,
      remaining,
      retryAfter,
    };
  }
}
