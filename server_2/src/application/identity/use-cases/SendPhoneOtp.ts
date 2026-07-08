import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { PhoneNumber } from '../../../domain/identity/value-objects/PhoneNumber.vo';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IOtpGenerator } from '../../../domain/identity/services/IOtpGenerator';
import { IOtpStore } from '../../../domain/identity/services/IOtpStore';
import { ISmsProvider } from '../../../domain/identity/services/ISmsProvider';
import { SendPhoneOtpDto } from '../dtos/SendPhoneOtpDto';
import { phoneVerificationOtpKey, OTP_TTL_SECONDS } from '../otp-keys';

export class SendPhoneOtp {
  constructor(
    private userRepo: IUserRepository,
    private otpGenerator: IOtpGenerator,
    private otpStore: IOtpStore,
    private smsProvider: ISmsProvider,
  ) {}

  async execute(dto: SendPhoneOtpDto): Promise<Result<void>> {
    const phoneResult = PhoneNumber.create(dto.phone);
    if (phoneResult.isFailure) return Result.fail(phoneResult.getError());
    const phone = phoneResult.getValue();

    const user = await this.userRepo.findById(dto.userId);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));

    const code = this.otpGenerator.generate();
    await this.otpStore.issue(phoneVerificationOtpKey(user._id), code, OTP_TTL_SECONDS.PHONE_VERIFICATION);

    await this.smsProvider.sendOtp(phone, code);

    return Result.ok();
  }
}
