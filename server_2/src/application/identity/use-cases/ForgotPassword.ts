import { Result } from '../../../domain/shared/Result';
import { Email } from '../../../domain/identity/value-objects/Email.vo';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IOtpGenerator } from '../../../domain/identity/services/IOtpGenerator';
import { IOtpStore } from '../../../domain/identity/services/IOtpStore';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { IEmailQueue } from '../../shared/queues/IEmailQueue';
import { IEmailComposer } from '../../../domain/identity/services/IEmailComposer';
import { ForgotPasswordDto } from '../dtos/ForgotPasswordDto';
import { passwordResetOtpKey, OTP_TTL_SECONDS } from '../otp-keys';
import { logger } from '../../../infrastructure/observability/logger';

export class ForgotPassword {
  constructor(
    private userRepo: IUserRepository,
    private otpGenerator: IOtpGenerator,
    private otpStore: IOtpStore,
    private unitOfWork: IUnitOfWork,
    private eventBus: IEventBus,
    private emailQueue: IEmailQueue,
    private emailComposer: IEmailComposer,
    private appBaseUrl: string,
  ) {}

  async execute(dto: ForgotPasswordDto): Promise<Result<void>> {
    const emailResult = Email.create(dto.email);
    if (emailResult.isFailure) return Result.fail(emailResult.getError());
    const email = emailResult.getValue();

    const user = await this.userRepo.findByEmail(email);
    if (!user) return Result.ok();

    const code = this.otpGenerator.generate();
    const issuedAtMs = Date.now();
    await this.otpStore.issue(passwordResetOtpKey(user._id), code, OTP_TTL_SECONDS.PASSWORD_RESET);

    const events = user.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.userRepo.update(user);
    });

    await this.eventBus.publishAll(events);

    // The reset code never becomes a domain event: an event is persisted to the `outbox`
    // collection, and no plaintext OTP may be written there. The code lives only in Redis —
    // the OTP store and the BullMQ job payload are the same store.
    await this.sendResetEmail(user._id, email.value, code, issuedAtMs);

    return Result.ok();
  }

  private async sendResetEmail(userId: string, email: string, code: string, issuedAtMs: number): Promise<void> {
    const resetUrl = `${this.appBaseUrl}/reset-password?email=${encodeURIComponent(email)}`;

    const composed = await this.emailComposer.compose('password_reset', { code, email, resetUrl });
    if (!composed) {
      logger.error({ userId, templateKey: 'password_reset' }, '[ForgotPassword] no active email template — reset email not sent');
      return;
    }

    await this.emailQueue.enqueue(
      { type: 'notification', to: email, subject: composed.subject, body: composed.body },
      { jobId: `pwreset-${userId}-${issuedAtMs}` },
    );
  }
}
