import { Result } from '../../../domain/shared/Result';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { IOtpStore } from '../../../domain/identity/services/IOtpStore';
import { VerifyEmailOtpDto } from '../dtos/VerifyEmailOtpDto';
import { emailVerificationOtpKey } from '../otp-keys';

// Generic, low-level OTP check only. Does NOT touch the aggregate and NEVER
// marks an email verified — that is VerifyEmail's sole responsibility.
export class VerifyEmailOtp {
  constructor(private otpStore: IOtpStore) {}

  async execute(dto: VerifyEmailOtpDto): Promise<Result<void>> {
    const otpResult = await this.otpStore.verify(emailVerificationOtpKey(dto.userId), dto.code);
    if (otpResult.isFailure) {
      return Result.fail(new ValidationError(String(otpResult.getError())));
    }
    return Result.ok();
  }
}
