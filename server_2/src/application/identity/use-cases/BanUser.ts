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
    // 1. Load actor and target
    const actor = await this.userRepo.findById(dto.actorId);
    if (!actor) return Result.fail(new NotFoundError('actor_not_found'));
    if (!(actor instanceof Admin)) return Result.fail(new ForbiddenError('actor_not_admin'));

    const target = await this.userRepo.findById(dto.targetUserId);
    if (!target) return Result.fail(new NotFoundError('user_not_found'));

    // 2. Authorize: only super-admins may ban admins
    try {
      actor.assertCanBan(target.role);
    } catch (e) {
      if (e instanceof DomainError) return Result.fail(e);
      throw e;
    }

    // 3. Ban target (raises UserBanned) and revoke its sessions/tokens
    target.ban(dto.reason);
    target.invalidateAllSessions();

    // 4. Pull events
    const events = target.pullDomainEvents();

    // 5. Atomic transaction: persist target + outbox
    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.userRepo.update(target);
      await this.outboxStore.append(events, ctx);
    });

    // 6. Post-commit: publish events + clear Redis sessions
    await this.eventBus.publishAll(events);
    await this.sessionStore.invalidateAll(target._id);

    return Result.ok();
  }
}
