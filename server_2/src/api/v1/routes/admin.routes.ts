import { Router } from 'express';
import { IdentityController } from '../controllers/IdentityController';
import { authenticate } from '../middleware/authenticate';
import { requireRole, requirePermission, PermissionDeps } from '../middleware/authorize';
import { audit } from '../middleware/audit';
import { validate } from '../middleware/validate';
import { ITokenService } from '../../../domain/identity/services/ITokenService';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';
import { PERMISSION_RESOURCE } from '../../../domain/identity/enums/permission-resource.enum';
import { PERMISSION_ACTION } from '../../../domain/identity/enums/permission-action.enum';
import { assignRoleSchema, grantPermissionSchema, banSchema, listDriversQuerySchema, listUsersQuerySchema } from '../validators/admin.validator';
import { userIdParam, adminIdParam, driverIdParam } from '../validators/common.validator';

export interface AdminRoutesDeps {
  controller: IdentityController;
  tokenService: ITokenService;
  permissionDeps: PermissionDeps;
}

export function createAdminRoutes(deps: AdminRoutesDeps): Router {
  const router = Router();
  const c = deps.controller;
  const auth = authenticate(deps.tokenService);
  const requireAdmin = requireRole(deps.permissionDeps, USER_ROLE.ADMIN);
  const requireUserUpdate = requirePermission(deps.permissionDeps, PERMISSION_RESOURCE.USER, PERMISSION_ACTION.UPDATE);
  const requireUserRead = requirePermission(deps.permissionDeps, PERMISSION_RESOURCE.USER, PERMISSION_ACTION.READ);

  router.get(
    '/users',
    auth,
    requireAdmin,
    requireUserRead,
    validate(listUsersQuerySchema, 'query'),
    c.listUsers,
  );

  router.post(
    '/users/:userId/role',
    auth,
    requireAdmin,
    requireUserUpdate,
    audit('admin.assign-role'),
    validate(userIdParam, 'params'),
    validate(assignRoleSchema),
    c.assignRole,
  );

  router.post(
    '/admins/:adminId/permissions',
    auth,
    requireAdmin,
    requireUserUpdate,
    audit('admin.grant-permission'),
    validate(adminIdParam, 'params'),
    validate(grantPermissionSchema),
    c.grantPermission,
  );

  router.post(
    '/users/:userId/ban',
    auth,
    requireAdmin,
    requireUserUpdate,
    audit('admin.ban-user'),
    validate(userIdParam, 'params'),
    validate(banSchema),
    c.banUser,
  );

  router.post(
    '/users/:userId/unban',
    auth,
    requireAdmin,
    requireUserUpdate,
    audit('admin.unban-user'),
    validate(userIdParam, 'params'),
    c.unbanUser,
  );

  router.get(
    '/drivers',
    auth,
    requireAdmin,
    requireUserRead,
    validate(listDriversQuerySchema, 'query'),
    c.listDrivers,
  );

  router.post(
    '/drivers/:id/verify',
    auth,
    requireAdmin,
    requireUserUpdate,
    audit('admin.verify-driver'),
    validate(driverIdParam, 'params'),
    c.verifyDriver,
  );

  return router;
}
