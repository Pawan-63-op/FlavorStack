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
