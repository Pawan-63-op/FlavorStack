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
    const user = await this.userRepo.findById(dto.userId);
    if (!user) return Result.fail(new NotFoundError('user_not_found'));

    user.invalidateAllSessions();

    const events = user.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.userRepo.update(user);
      if (events.length > 0) {
        await this.outboxStore.append(events, ctx);
      }
    });

    if (events.length > 0) {
      await this.eventBus.publishAll(events);
    }
    await this.sessionStore.invalidateAll(dto.userId);

    return Result.ok();
  }
}
