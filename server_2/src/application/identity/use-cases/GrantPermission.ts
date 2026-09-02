import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';
import { DomainError } from '../../../domain/shared/errors/DomainError';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { Admin } from '../../../domain/identity/entities/Admin';
import { Permission } from '../../../domain/identity/value-objects/Permission.vo';
import { PERMISSION_RESOURCE } from '../../../domain/identity/enums/permission-resource.enum';
import { PERMISSION_ACTION } from '../../../domain/identity/enums/permission-action.enum';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { GrantPermissionDto } from '../dtos/GrantPermissionDto';

export class GrantPermission {
  constructor(
    private userRepo: IUserRepository,
    private unitOfWork: IUnitOfWork,
    private eventBus: IEventBus,
  ) {}

  async execute(dto: GrantPermissionDto): Promise<Result<void>> {
    const actor = await this.userRepo.findById(dto.actorId);
    if (!actor) return Result.fail(new NotFoundError('actor_not_found'));
    if (!(actor instanceof Admin)) return Result.fail(new ForbiddenError('actor_not_admin'));

    const target = await this.userRepo.findById(dto.targetAdminId);
    if (!target) return Result.fail(new NotFoundError('admin_not_found'));
    if (!(target instanceof Admin)) return Result.fail(new NotFoundError('admin_not_found'));

    try {
      actor.assertPermission(PERMISSION_RESOURCE.USER, PERMISSION_ACTION.MANAGE);
    } catch (e) {
      if (e instanceof DomainError) return Result.fail(e);
      throw e;
    }

    const permissionResult = Permission.create({
      resource: dto.resource,
      action: dto.action,
      scope: dto.scope,
    });
    if (permissionResult.isFailure) return Result.fail(permissionResult.getError());

    target.grantPermission(permissionResult.getValue());

    const events = target.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.userRepo.update(target);
    });

    if (events.length > 0) {
      await this.eventBus.publishAll(events);
    }

    return Result.ok();
  }
}
