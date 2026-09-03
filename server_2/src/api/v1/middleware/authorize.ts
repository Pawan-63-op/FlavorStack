import { Request, Response, NextFunction, RequestHandler } from 'express';
import { UserRole } from '../../../domain/identity/enums/user-role.enum';
import { PermissionResource } from '../../../domain/identity/enums/permission-resource.enum';
import { PermissionAction } from '../../../domain/identity/enums/permission-action.enum';
import { IUserRepository } from '../../../domain/identity/repositories/IUserRepository';
import { IRbacService } from '../../../domain/identity/services/IRbacService';
import { Admin } from '../../../domain/identity/entities/Admin';
import { BaseUser } from '../../../domain/identity/entities/BaseUser';
import { ForbiddenError } from '../../../domain/shared/errors/ForbiddenError';

export interface PermissionDeps {
  userRepository: IUserRepository;
  rbacService: IRbacService;
}

type ActorOutcome =
  | { kind: 'ok'; user: BaseUser }
  | { kind: 'not_found' }
  | { kind: 'rejected'; error: ForbiddenError };

/**
 * Admin routes stack `requireRole` and `requirePermission`, which would otherwise load the same
 * actor twice per request. Scoped to the request object, so it cannot outlive the request.
 */
const actorCache = new WeakMap<Request, Promise<ActorOutcome>>();

/**
 * The step both guards share: load the actor behind the token and reject it when the account is
 * no longer usable (banned/inactive) or the token predates a credential change. Keeping it in one
 * place is what stops `requireRole` and `requirePermission` from drifting apart on revocation.
 */
function loadActor(deps: PermissionDeps, req: Request, claims: NonNullable<Request['user']>): Promise<ActorOutcome> {
  const cached = actorCache.get(req);
  if (cached) return cached;

  const pending = resolveActor(deps, claims);
  actorCache.set(req, pending);
  return pending;
}

async function resolveActor(deps: PermissionDeps, claims: NonNullable<Request['user']>): Promise<ActorOutcome> {
  const user = await deps.userRepository.findById(claims.userId);
  if (!user) return { kind: 'not_found' };

  if (user.isBanned || !user.isActive) {
    return { kind: 'rejected', error: new ForbiddenError('account_locked_or_banned') };
  }

  if (user.tokenVersion !== claims.tokenVersion) {
    return { kind: 'rejected', error: new ForbiddenError('token_version_mismatch') };
  }

  return { kind: 'ok', user };
}

/**
 * Role check backed by the persisted user, not just the JWT claim — a ban, a deactivation or a
 * credential change takes effect on the next request instead of when the access token expires.
 */
export function requireRole(deps: PermissionDeps, ...roles: UserRole[]): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new ForbiddenError('invalid_token'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError(`insufficient_role: requires ${roles.join(' or ')}`, { requiredRoles: roles }));
      return;
    }

    const outcome = await loadActor(deps, req, req.user);
    if (outcome.kind === 'not_found') {
      next(new ForbiddenError('account_locked_or_banned'));
      return;
    }
    if (outcome.kind === 'rejected') {
      next(outcome.error);
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

    const outcome = await loadActor(deps, req, req.user);
    if (outcome.kind === 'not_found') {
      next(new ForbiddenError('actor_not_admin'));
      return;
    }
    if (outcome.kind === 'rejected') {
      next(outcome.error);
      return;
    }

    const user = outcome.user;
    if (!(user instanceof Admin)) {
      next(new ForbiddenError('actor_not_admin'));
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
