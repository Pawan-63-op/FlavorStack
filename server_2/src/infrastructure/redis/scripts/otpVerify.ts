export const OTP_VERIFY_SCRIPT = `
local maxAttempts = tonumber(ARGV[2])
local attempts = tonumber(redis.call('GET', KEYS[2])) or 0

if attempts >= maxAttempts then
  return 'OTP_MAX_ATTEMPTS'
end

local stored = redis.call('GET', KEYS[1])
if not stored then
  return 'OTP_EXPIRED'
end

if stored == ARGV[1] then
  return 'OK'
end

local newAttempts = redis.call('INCR', KEYS[2])
if newAttempts == 1 then
  local ttl = redis.call('TTL', KEYS[1])
  if ttl > 0 then
    redis.call('EXPIRE', KEYS[2], ttl)
  end
end

return 'OTP_INVALID'
`;
