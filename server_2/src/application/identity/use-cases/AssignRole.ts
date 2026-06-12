import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { DomainError } from '../../../domain/shared/errors/DomainError';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { Admin } from '../../../domain/identity/entities/Admin';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IOutboxStore } from '../../shared/outbox/IOutboxStore';
import { IEventBus } from '../../shared/events/IEventBus';
import { AssignRoleDto } from '../dtos/AssignRoleDto';

export class AssignRole {
  constructor(
    private userRepo: IUserRepository,
    private unitOfWork: IUnitOfWork,
    private outboxStore: IOutboxStore,
    private eventBus: IEventBus,
  ) {}

  async execute(dto: AssignRoleDto): Promise<Result<void>> {
    // 1. Load actor and target
    const actor = await this.userRepo.findById(dto.actorId);
    if (!actor) return Result.fail(new NotFoundError('actor_not_found'));
    if (!(actor instanceof Admin)) return Result.fail(new ForbiddenError('actor_not_admin'));

    const target = await this.userRepo.findById(dto.targetUserId);
    if (!target) return Result.fail(new NotFoundError('user_not_found'));

    // 2. Authorize + raise RoleAssigned (on the actor's domain-event queue,
    //    aggregateId = target user) and enforce super-admin-for-admin-role rule
    try {
      actor.assignRole(target._id, dto.role);
    } catch (e) {
      if (e instanceof DomainError) return Result.fail(e);
      throw e;
    }

    // 3. Apply the role change to the target
    target.role = dto.role;

    // 4. Pull events (raised on the actor aggregate)
    const events = actor.pullDomainEvents();

    // 5. Atomic transaction: persist target + outbox
    await this.unitOfWork.runInTransaction(async (ctx) => {
      await this.userRepo.update(target);
      await this.outboxStore.append(events, ctx);
    });

    // 6. Post-commit: publish events
    await this.eventBus.publishAll(events);

    return Result.ok();
  }
}
