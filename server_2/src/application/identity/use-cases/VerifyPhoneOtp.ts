import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IOtpStore } from '../../../domain/identity/services/IOtpStore';
import { VerifyPhoneOtpDto } from '../dtos/VerifyPhoneOtpDto';
import { phoneVerificationOtpKey } from '../otp-keys';

export class VerifyPhoneOtp {
  constructor(
    private userRepo: IUserRepository,
    private otpStore: IOtpStore,
  ) {}

  async execute(dto: VerifyPhoneOtpDto): Promise<Result<void>> {
    const user = await this.userRepo.findById(dto.userId);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));

    const otpResult = await this.otpStore.verify(phoneVerificationOtpKey(user._id), dto.code);
    if (otpResult.isFailure) {
      return Result.fail(new ValidationError(String(otpResult.getError())));
    }

    return Result.ok();
  }
}
