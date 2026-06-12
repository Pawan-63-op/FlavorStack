// OtpStore — implements IOtpStore using otp:{key} (issued code) + rate:otp:{key} (failed-attempt counter)
import { Result } from '../../domain/shared/Result';
import { IOtpStore } from '../../domain/identity/services/IOtpStore';
import { RedisClient } from './client';
import { otpKey, otpAttemptsKey } from './keys';
import { OTP_VERIFY_SCRIPT } from './scripts/otpVerify';

const MAX_OTP_ATTEMPTS = 5;

type OtpVerifyReply = 'OK' | 'OTP_INVALID' | 'OTP_EXPIRED' | 'OTP_MAX_ATTEMPTS';

export class OtpStore implements IOtpStore {
  constructor(private readonly redisClient: RedisClient) {}

  async issue(key: string, code: string, ttlSeconds: number): Promise<void> {
    await this.redisClient
      .getClient()
      .pipeline()
      .set(otpKey(key), code, 'EX', ttlSeconds)
      .del(otpAttemptsKey(key))
      .exec();
  }

  async verify(key: string, code: string): Promise<Result<void>> {
    const reply = (await this.redisClient
      .getClient()
      .eval(OTP_VERIFY_SCRIPT, 2, otpKey(key), otpAttemptsKey(key), code, MAX_OTP_ATTEMPTS)) as OtpVerifyReply;

    switch (reply) {
      case 'OK':
        return Result.ok();
      case 'OTP_MAX_ATTEMPTS':
        return Result.fail('OTP_MAX_ATTEMPTS');
      case 'OTP_EXPIRED':
        return Result.fail('OTP_EXPIRED');
      case 'OTP_INVALID':
      default:
        return Result.fail('OTP_INVALID');
    }
  }

  async consume(key: string): Promise<void> {
    await this.redisClient.getClient().pipeline().del(otpKey(key)).del(otpAttemptsKey(key)).exec();
  }
}
