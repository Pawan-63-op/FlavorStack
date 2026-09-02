import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { Password } from '../../../domain/identity/value-objects/Password.vo';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IPasswordHasher } from '../../../domain/identity/services/IPasswordHasher';
import { ISessionStore } from '../../../domain/identity/services/ISessionStore';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { ChangePasswordDto } from '../dtos/ChangePasswordDto';

export class ChangePassword {
  constructor(
    private userRepo: IUserRepository,
    private passwordHasher: IPasswordHasher,
    private sessionStore: ISessionStore,
    private unitOfWork: IUnitOfWork,
    private eventBus: IEventBus,
  ) {}

  async execute(dto: ChangePasswordDto): Promise<Result<void>> {
    const user = await this.userRepo.findById(dto.userId);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));

    const currentMatches = await this.passwordHasher.compare(dto.currentPassword, user.passwordHash);
    if (!currentMatches) return Result.fail(new ForbiddenError('invalid_current_password'));

    const newPasswordResult = Password.create(dto.newPassword);
    if (newPasswordResult.isFailure) return Result.fail(newPasswordResult.getError());

    const newPasswordHash = await this.passwordHasher.hash(dto.newPassword);

    user.changePassword(newPasswordHash);
    user.invalidateAllSessions();

    const events = user.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.userRepo.update(user);
    });

    await this.eventBus.publishAll(events);
    await this.sessionStore.invalidateAll(dto.userId);

    return Result.ok();
  }
}
