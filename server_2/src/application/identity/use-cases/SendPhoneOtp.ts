import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { PhoneNumber } from '../../../domain/identity/value-objects/PhoneNumber.vo';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IOtpGenerator } from '../../../domain/identity/services/IOtpGenerator';
import { IOtpStore } from '../../../domain/identity/services/IOtpStore';
import { ISmsProvider } from '../../../domain/identity/services/ISmsProvider';
import { SendPhoneOtpDto } from '../dtos/SendPhoneOtpDto';
import { phoneVerificationOtpKey, OTP_TTL_SECONDS } from '../otp-keys';

// SMS delivery is contract-only in Phase 5 (no concrete adapter — see
// ISmsProvider). Send-rate limiting (send cap) is enforced at the API layer
// (Phase 10 rateLimiter middleware).
export class SendPhoneOtp {
  constructor(
    private userRepo: IUserRepository,
    private otpGenerator: IOtpGenerator,
    private otpStore: IOtpStore,
    private smsProvider: ISmsProvider,
  ) {}

  async execute(dto: SendPhoneOtpDto): Promise<Result<void>> {
    // 1. Validate phone number
    const phoneResult = PhoneNumber.create(dto.phone);
    if (phoneResult.isFailure) return Result.fail(phoneResult.getError());
    const phone = phoneResult.getValue();

    // 2. Load user
    const user = await this.userRepo.findById(dto.userId);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));

    // 3. Generate + store OTP
    const code = this.otpGenerator.generate();
    await this.otpStore.issue(phoneVerificationOtpKey(user._id), code, OTP_TTL_SECONDS.PHONE_VERIFICATION);

    // 4. Send via SMS
    await this.smsProvider.sendOtp(phone, code);

    return Result.ok();
  }
}
