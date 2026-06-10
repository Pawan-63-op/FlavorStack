import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { ISessionStore } from '../../../domain/identity/services/ISessionStore';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { LogoutAllDto } from '../dtos/LogoutAllDto';

export class LogoutAllSessions {
  constructor(
    private userRepo: IUserRepository,
    private sessionStore: ISessionStore,
    private unitOfWork: IUnitOfWork,
    private outboxStore: IOutboxStore,
    private eventBus: IEventBus,
  ) {}

  async execute(dto: LogoutAllDto): Promise<Result<void>> {
    // 1. Load user
    const user = await this.userRepo.findById(dto.userId);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));

    // 2. Bump tokenVersion (no domain event raised)
    user.invalidateAllSessions();

    // 3. Pull events (will be empty)
    const events = user.pullDomainEvents();

    // 4. Atomic transaction: update user (tokenVersion bump)
    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.userRepo.update(user);
      if (events.length > 0) {
        await this.outboxStore.append(events, ctx);
      }
    });

    // 5. Post-commit: publish events (no-op if empty) and clear Redis sessions
    if (events.length > 0) {
      await this.eventBus.publishAll(events);
    }
    await this.sessionStore.invalidateAll(dto.userId);

    return Result.ok();
  }
}
