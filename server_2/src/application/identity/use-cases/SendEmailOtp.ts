import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { Email } from '../../../domain/identity/value-objects/Email.vo';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IOtpGenerator } from '../../../domain/identity/services/IOtpGenerator';
import { IOtpStore } from '../../../domain/identity/services/IOtpStore';
import { IEmailProvider } from '../../../domain/identity/services/IEmailProvider';
import { SendEmailOtpDto } from '../dtos/SendEmailOtpDto';
import { emailVerificationOtpKey, OTP_TTL_SECONDS } from '../otp-keys';

// Send-rate limiting (send cap) is enforced at the API layer (Phase 10
// rateLimiter middleware), not here — no rate-limit port exists in the
// approved Phase 5 application-shared contracts.
export class SendEmailOtp {
  constructor(
    private userRepo: IUserRepository,
    private otpGenerator: IOtpGenerator,
    private otpStore: IOtpStore,
    private emailProvider: IEmailProvider,
  ) {}

  async execute(dto: SendEmailOtpDto): Promise<Result<void>> {
    // 1. Load user
    const user = await this.userRepo.findById(dto.userId);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));

    // 2. Generate + store OTP
    const code = this.otpGenerator.generate();
    await this.otpStore.issue(emailVerificationOtpKey(user._id), code, OTP_TTL_SECONDS.EMAIL_VERIFICATION);

    // 3. Send via email
    const emailResult = Email.create(user.email);
    if (emailResult.isFailure) return Result.fail(emailResult.getError());
    await this.emailProvider.sendVerification(emailResult.getValue(), code);

    return Result.ok();
  }
}
