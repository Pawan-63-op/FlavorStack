import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { Password } from '../../../domain/identity/value-objects/Password.vo';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IPasswordHasher } from '../../../domain/identity/services/IPasswordHasher';
import { ISessionStore } from '../../../domain/identity/services/ISessionStore';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { ChangePasswordDto } from '../dtos/ChangePasswordDto';

export class ChangePassword {
  constructor(
    private userRepo: IUserRepository,
    private passwordHasher: IPasswordHasher,
    private sessionStore: ISessionStore,
    private unitOfWork: IUnitOfWork,
    private outboxStore: IOutboxStore,
    private eventBus: IEventBus,
  ) {}

  async execute(dto: ChangePasswordDto): Promise<Result<void>> {
    // 1. Load user
    const user = await this.userRepo.findById(dto.userId);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));

    // 2. Verify current password
    const currentMatches = await this.passwordHasher.compare(dto.currentPassword, user.passwordHash);
    if (!currentMatches) return Result.fail(new ForbiddenError('invalid_current_password'));

    // 3. Validate new password strength
    const newPasswordResult = Password.create(dto.newPassword);
    if (newPasswordResult.isFailure) return Result.fail(newPasswordResult.getError());

    // 4. Hash new password
    const newPasswordHash = await this.passwordHasher.hash(dto.newPassword);

    // 5. Mutate aggregate (raises PasswordChanged) and invalidate sessions (bumps tokenVersion)
    user.changePassword(newPasswordHash);
    user.invalidateAllSessions();

    // 6. Pull events
    const events = user.pullDomainEvents();

    // 7. Atomic transaction: persist + outbox
    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.userRepo.update(user);
      await this.outboxStore.append(events, ctx);
    });

    // 8. Post-commit: publish events + clear Redis sessions
    await this.eventBus.publishAll(events);
    await this.sessionStore.invalidateAll(dto.userId);

    return Result.ok();
  }
}
