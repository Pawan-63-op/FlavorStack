// RBAC: requireRole (claim check) + requirePermission (resource/action check)
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { UserRole } from '../../../domain/identity/enums/user-role.enum';
import { PermissionResource } from '../../../domain/identity/enums/permission-resource.enum';
import { PermissionAction } from '../../../domain/identity/enums/permission-action.enum';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IRbacService } from '../../../domain/identity/services/IRbacService';
import { Admin } from '../../../domain/identity/entities/Admin';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';

export interface PermissionDeps {
  userRepository: IUserRepository;
  rbacService: IRbacService;
}

/** Cheap claim check on `req.user.role` — no DB access. Super-admins also carry role 'admin'. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ForbiddenError('invalid_token'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('actor_not_admin'));
      return;
    }

    next();
  };
}

/** Loads the Admin aggregate and delegates to IRbacService; super-admin bypass lives on Admin.hasPermission. */
export function requirePermission(
  deps: PermissionDeps,
  resource: PermissionResource,
  action: PermissionAction,
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new ForbiddenError('invalid_token'));
      return;
    }

    const user = await deps.userRepository.findById(req.user.userId);

    if (!(user instanceof Admin)) {
      next(new ForbiddenError('actor_not_admin'));
      return;
    }

    if (user.isBanned || !user.isActive) {
      next(new ForbiddenError('account_locked_or_banned'));
      return;
    }

    const result = deps.rbacService.authorize(user, resource, action);
    if (result.isFailure) {
      next(result.getError());
      return;
    }

    next();
  };
}
