import { IRbacService } from '../../domain/identity/services/IRbacService';
import { BaseUser } from '../../domain/identity/entities/BaseUser';
import { Admin } from '../../domain/identity/entities/Admin';
import { UserRole } from '../../domain/identity/enums/user-role.enum';
import { PermissionResource } from '../../domain/identity/enums/permission-resource.enum';
import { PermissionAction } from '../../domain/identity/enums/permission-action.enum';
import { Result } from '../../domain/shared/Result';
import { ForbiddenError } from '../../domain/shared/errors/ForbiddenError';

/** Delegates RBAC decisions to `Admin.hasPermission` (super-admin bypass lives there). */
export class RbacService implements IRbacService {
  can(admin: Admin, resource: PermissionResource, action: PermissionAction): boolean {
    return admin.hasPermission(resource, action);
  }

  hasRole(user: BaseUser, role: UserRole): boolean {
    return user.role === role;
  }

  authorize(admin: Admin, resource: PermissionResource, action: PermissionAction): Result<void> {
    if (this.can(admin, resource, action)) return Result.ok();

    return Result.fail(
      new ForbiddenError(`Permission denied for action "${action}" on resource "${resource}"`),
    );
  }
}
