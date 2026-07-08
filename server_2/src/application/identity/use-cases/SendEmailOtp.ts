import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { Email } from '../../../domain/identity/value-objects/Email.vo';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IOtpGenerator } from '../../../domain/identity/services/IOtpGenerator';
import { IOtpStore } from '../../../domain/identity/services/IOtpStore';
import { IEmailProvider } from '../../../domain/identity/services/IEmailProvider';
import { SendEmailOtpDto } from '../dtos/SendEmailOtpDto';
import { emailVerificationOtpKey, OTP_TTL_SECONDS } from '../otp-keys';

export class SendEmailOtp {
  constructor(
    private userRepo: IUserRepository,
    private otpGenerator: IOtpGenerator,
    private otpStore: IOtpStore,
    private emailProvider: IEmailProvider,
  ) {}

  async execute(dto: SendEmailOtpDto): Promise<Result<void>> {
    const user = await this.userRepo.findById(dto.userId);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));

    const code = this.otpGenerator.generate();
    await this.otpStore.issue(emailVerificationOtpKey(user._id), code, OTP_TTL_SECONDS.EMAIL_VERIFICATION);

    const emailResult = Email.create(user.email);
    if (emailResult.isFailure) return Result.fail(emailResult.getError());
    await this.emailProvider.sendVerification(emailResult.getValue(), code);

    return Result.ok();
  }
}
