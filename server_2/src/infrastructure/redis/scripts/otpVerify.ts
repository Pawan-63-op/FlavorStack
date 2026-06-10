// Lua script for OtpStore.verify — atomic attempt-cap check + code comparison
// against `otp:{key}` (the issued code) and `rate:otp:{key}` (failed-attempt counter).
//
// KEYS[1] = otp:{key}        — the issued OTP code
// KEYS[2] = rate:otp:{key}   — failed-attempt counter
// ARGV[1] = code submitted by the caller
// ARGV[2] = max allowed failed attempts
//
// Returns one of:
//   "OK"               — code matches; caller should call consume()
//   "OTP_MAX_ATTEMPTS" — attempt cap reached; locked out (no comparison performed)
//   "OTP_EXPIRED"      — otp:{key} missing or expired
//   "OTP_INVALID"      — code does not match (attempt counter incremented)
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
