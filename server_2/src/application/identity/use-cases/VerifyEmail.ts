import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { Email } from '../../../domain/identity/value-objects/Email.vo';
import { BaseUser } from '../../../domain/identity/entities/BaseUser';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IOtpStore } from '../../../domain/identity/services/IOtpStore';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
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
    private eventBus: IEventBus,
  ) {}

  async execute(dto: VerifyEmailDto): Promise<Result<UserResponse>> {
    let user: BaseUser | null;
    if (dto.userId) {
      user = await this.userRepo.findById(dto.userId);
    } else if (dto.email) {
      const emailResult = Email.create(dto.email);
      if (emailResult.isFailure) return Result.fail(emailResult.getError());
      user = await this.userRepo.findByEmail(emailResult.getValue());
    } else {
      return Result.fail(new ValidationError('email_or_user_id_required'));
    }

    if (!user) return Result.fail(new NotFoundError('user_not_found'));

    if (user.isEmailVerified) {
      return Result.fail(new ConflictError('email_already_verified'));
    }

    const otpResult = await this.otpStore.verify(emailVerificationOtpKey(user._id), dto.code);
    if (otpResult.isFailure) {
      return Result.fail(new ValidationError(String(otpResult.getError())));
    }
    await this.otpStore.consume(emailVerificationOtpKey(user._id));

    user.verifyEmail();

    const events = user.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.userRepo.update(user);
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toUserResponse(user));
  }
}
