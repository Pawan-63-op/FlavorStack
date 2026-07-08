import { Result } from '../../../domain/shared/Result';
import { Email } from '../../../domain/identity/value-objects/Email.vo';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IOtpGenerator } from '../../../domain/identity/services/IOtpGenerator';
import { IOtpStore } from '../../../domain/identity/services/IOtpStore';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { ForgotPasswordDto } from '../dtos/ForgotPasswordDto';
import { passwordResetOtpKey, OTP_TTL_SECONDS } from '../otp-keys';

export class ForgotPassword {
  constructor(
    private userRepo: IUserRepository,
    private otpGenerator: IOtpGenerator,
    private otpStore: IOtpStore,
    private unitOfWork: IUnitOfWork,
    private outboxStore: IOutboxStore,
    private eventBus: IEventBus,
  ) {}

  async execute(dto: ForgotPasswordDto): Promise<Result<void>> {
    const emailResult = Email.create(dto.email);
    if (emailResult.isFailure) return Result.fail(emailResult.getError());
    const email = emailResult.getValue();

    const user = await this.userRepo.findByEmail(email);
    if (!user) return Result.ok();

    const code = this.otpGenerator.generate();
    await this.otpStore.issue(passwordResetOtpKey(user._id), code, OTP_TTL_SECONDS.PASSWORD_RESET);

    user.requestPasswordReset();

    const events = user.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.userRepo.update(user);
      await this.outboxStore.append(events, ctx);
    });

    await this.eventBus.publishAll(events);

    return Result.ok();
  }
}
