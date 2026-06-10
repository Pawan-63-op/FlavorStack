// Lua script for RateLimiter.check — atomic sorted-set sliding-window counter.
// The single EVAL is the sole writer per call, so concurrent requests sharing
// the same key cannot overshoot `max` (no check-then-act race).
//
// KEYS[1] = rate:{action}:{identifier}  — sorted set of in-window request timestamps
// ARGV[1] = now            — current time in ms (unix epoch)
// ARGV[2] = windowMs       — window length in ms
// ARGV[3] = max            — max requests allowed per window
// ARGV[4] = windowSeconds  — window length in seconds (for EXPIRE)
// ARGV[5] = member         — unique member for this request's ZADD
//
// Returns a 3-element array: { allowed, remaining, retryAfter }
//   allowed     — 1 if this request is permitted, 0 if it exceeds the limit
//   remaining   — requests left in the window after this call (0 when blocked)
//   retryAfter  — seconds until the oldest in-window entry expires (0 when allowed)
export const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local windowSeconds = tonumber(ARGV[4])
local member = ARGV[5]

-- Drop timestamps older than the sliding window.
redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)

local count = redis.call('ZCARD', key)
local allowed = 0
local remaining = 0

if count < max then
  redis.call('ZADD', key, now, member)
  allowed = 1
  count = count + 1
  remaining = max - count
end

-- Idle keys self-evict once the window passes.
redis.call('EXPIRE', key, windowSeconds)

local retryAfter = 0
if allowed == 0 then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  if oldest[2] then
    local resetAt = tonumber(oldest[2]) + windowMs
    retryAfter = math.ceil((resetAt - now) / 1000)
    if retryAfter < 0 then
      retryAfter = 0
    end
  end
end

return { allowed, remaining, retryAfter }
`;
