import { Router } from 'express';
import { IdentityController } from '../controllers/IdentityController';
import { authenticate } from '../middleware/authenticate';
import { requireRole, PermissionDeps } from '../middleware/authorize';
import { audit } from '../middleware/audit';
import { validate } from '../middleware/validate';
import { ITokenService } from '../../../domain/identity/services/ITokenService';
import { USER_ROLE } from '../../../domain/identity/enums/user-role.enum';
import { updateMeSchema, setAvailabilitySchema, addressBodySchema } from '../validators/user.validator';

export interface UserRoutesDeps {
  controller: IdentityController;
  tokenService: ITokenService;
  permissionDeps: PermissionDeps;
}

export function createUserRoutes(deps: UserRoutesDeps): Router {
  const router = Router();
  const c = deps.controller;
  const auth = authenticate(deps.tokenService);

  router.get('/me', auth, c.getMe);

  router.patch('/me', auth, audit('identity.update-profile'), validate(updateMeSchema), c.updateMe);

  router.patch(
    '/me/availability',
    auth,
    requireRole(deps.permissionDeps, USER_ROLE.DRIVER),
    audit('identity.set-availability'),
    validate(setAvailabilitySchema),
    c.setAvailability,
  );

  const customerOnly = requireRole(deps.permissionDeps, USER_ROLE.CUSTOMER);

  router.get('/me/addresses', auth, customerOnly, c.listAddresses);

  router.post(
    '/me/addresses',
    auth,
    customerOnly,
    audit('identity.add-address'),
    validate(addressBodySchema),
    c.addAddress,
  );

  router.patch(
    '/me/addresses/:addressId',
    auth,
    customerOnly,
    audit('identity.update-address'),
    validate(addressBodySchema),
    c.updateAddress,
  );

  router.delete(
    '/me/addresses/:addressId',
    auth,
    customerOnly,
    audit('identity.delete-address'),
    c.deleteAddress,
  );

  router.patch(
    '/me/addresses/:addressId/default',
    auth,
    customerOnly,
    audit('identity.set-default-address'),
    c.setDefaultAddress,
  );

  return router;
}
