import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { Email } from '../../../domain/identity/value-objects/Email.vo';
import { Password } from '../../../domain/identity/value-objects/Password.vo';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IOtpStore } from '../../../domain/identity/services/IOtpStore';
import { IPasswordHasher } from '../../../domain/identity/services/IPasswordHasher';
import { ISessionStore } from '../../../domain/identity/services/ISessionStore';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { ResetPasswordDto } from '../dtos/ResetPasswordDto';
import { passwordResetOtpKey } from '../otp-keys';

export class ResetPassword {
  constructor(
    private userRepo: IUserRepository,
    private otpStore: IOtpStore,
    private passwordHasher: IPasswordHasher,
    private sessionStore: ISessionStore,
    private unitOfWork: IUnitOfWork,
    private outboxStore: IOutboxStore,
    private eventBus: IEventBus,
  ) {}

  async execute(dto: ResetPasswordDto): Promise<Result<void>> {
    // 1. Validate email VO
    const emailResult = Email.create(dto.email);
    if (emailResult.isFailure) return Result.fail(emailResult.getError());
    const email = emailResult.getValue();

    // 2. Validate new password strength
    const newPasswordResult = Password.create(dto.newPassword);
    if (newPasswordResult.isFailure) return Result.fail(newPasswordResult.getError());

    // 3. Load user
    const user = await this.userRepo.findByEmail(email);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));

    // 4. Validate OTP via IOtpStore
    const otpResult = await this.otpStore.verify(passwordResetOtpKey(user._id), dto.code);
    if (otpResult.isFailure) {
      return Result.fail(new ValidationError(String(otpResult.getError())));
    }
    await this.otpStore.consume(passwordResetOtpKey(user._id));

    // 5. Hash new password
    const newPasswordHash = await this.passwordHasher.hash(dto.newPassword);

    // 6. Mutate aggregate (raises PasswordResetCompleted, bumps tokenVersion)
    user.completePasswordReset(newPasswordHash);

    // 7. Pull events
    const events = user.pullDomainEvents();

    // 8. Atomic transaction: persist + outbox
    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.userRepo.update(user);
      await this.outboxStore.append(events, ctx);
    });

    // 9. Post-commit: publish events + clear Redis sessions
    await this.eventBus.publishAll(events);
    await this.sessionStore.invalidateAll(user._id);

    return Result.ok();
  }
}
