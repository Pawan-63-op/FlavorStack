// RateLimiter — infra-only sorted-set sliding-window limiter over Redis.
// No domain interface: the eventual consumer is the API rate-limit middleware.
// The count-and-add runs inside a single atomic Lua script (see slidingWindow.ts),
// making it distributed-safe across API instances sharing one Redis.
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

/** Default per-action rules; override via the constructor for tests or tuning. */
export const DEFAULT_RATE_LIMITS: Record<RateLimitAction, RateLimitRule> = {
  login: { windowSeconds: 900, max: 5 },
  'otp-generation': { windowSeconds: 600, max: 3 },
  'otp-verification': { windowSeconds: 600, max: 5 },
  'password-reset': { windowSeconds: 3600, max: 3 },
  // Public, unauthenticated discovery (search/nearby) — keyed by IP, generous.
  'catalog-search': { windowSeconds: 60, max: 60 },
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
    // Unique member so simultaneous calls in the same ms each count distinctly.
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
