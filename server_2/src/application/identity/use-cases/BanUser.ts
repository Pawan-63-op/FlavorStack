import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { DomainError } from '../../../domain/shared/errors/DomainError';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { Admin } from '../../../domain/identity/entities/Admin';
import { ISessionStore } from '../../../domain/identity/services/ISessionStore';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { BanUserDto } from '../dtos/BanUserDto';

export class BanUser {
  constructor(
    private userRepo: IUserRepository,
    private sessionStore: ISessionStore,
    private unitOfWork: IUnitOfWork,
    private outboxStore: IOutboxStore,
    private eventBus: IEventBus,
  ) {}

  async execute(dto: BanUserDto): Promise<Result<void>> {
    const actor = await this.userRepo.findById(dto.actorId);
    if (!actor) return Result.fail(new NotFoundError('actor_not_found'));
    if (!(actor instanceof Admin)) return Result.fail(new ForbiddenError('actor_not_admin'));

    const target = await this.userRepo.findById(dto.targetUserId);
    if (!target) return Result.fail(new NotFoundError('user_not_found'));

    try {
      actor.assertCanBan(target.role);
    } catch (e) {
      if (e instanceof DomainError) return Result.fail(e);
      throw e;
    }

    target.ban(dto.reason);
    target.invalidateAllSessions();

    const events = target.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.userRepo.update(target);
      await this.outboxStore.append(events, ctx);
    });

    await this.eventBus.publishAll(events);
    await this.sessionStore.invalidateAll(target._id);

    return Result.ok();
  }
}
