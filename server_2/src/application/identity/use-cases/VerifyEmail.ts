import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { Email } from '../../../domain/identity/value-objects/Email.vo';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IOtpStore } from '../../../domain/identity/services/IOtpStore';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { VerifyEmailDto } from '../dtos/VerifyEmailDto';
import { UserResponse } from '../responses/UserResponse';
import { toUserResponse } from '../responses/mappers';
import { emailVerificationOtpKey } from '../otp-keys';

export class VerifyEmail {
  constructor(
    private userRepo: IUserRepository,
    private otpStore: IOtpStore,
    private unitOfWork: IUnitOfWork,
    private outboxStore: IOutboxStore,
    private eventBus: IEventBus,
  ) {}

  async execute(dto: VerifyEmailDto): Promise<Result<UserResponse>> {
    // 1. Validate email VO
    const emailResult = Email.create(dto.email);
    if (emailResult.isFailure) return Result.fail(emailResult.getError());
    const email = emailResult.getValue();

    // 2. Load user
    const user = await this.userRepo.findByEmail(email);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));

    // 3. Guard: only VerifyEmail may set isEmailVerified, and only once
    if (user.isEmailVerified) {
      return Result.fail(new ConflictError('email_already_verified'));
    }

    // 4. Validate OTP via IOtpStore
    const otpResult = await this.otpStore.verify(emailVerificationOtpKey(user._id), dto.code);
    if (otpResult.isFailure) {
      return Result.fail(new ValidationError(String(otpResult.getError())));
    }
    await this.otpStore.consume(emailVerificationOtpKey(user._id));

    // 5. Mutate aggregate (raises UserVerified)
    user.verifyEmail();

    // 6. Pull events
    const events = user.pullDomainEvents();

    // 7. Atomic transaction: persist + outbox
    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.userRepo.update(user);
      await this.outboxStore.append(events, ctx);
    });

    // 8. Post-commit publish
    await this.eventBus.publishAll(events);

    return Result.ok(toUserResponse(user));
  }
}
