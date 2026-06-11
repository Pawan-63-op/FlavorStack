// Mounts IdentityController self-service profile routes — protected
import { Router } from 'express';
import { IdentityController } from '../controllers/IdentityController';
import { authenticate } from '../middleware/authenticate';
import { audit } from '../middleware/audit';
import { validate } from '../middleware/validate';
import { ITokenService } from '../../../domain/identity/services/ITokenService';
import { updateMeSchema } from '../validators/user.validator';

export interface UserRoutesDeps {
  controller: IdentityController;
  tokenService: ITokenService;
}

export function createUserRoutes(deps: UserRoutesDeps): Router {
  const router = Router();
  const c = deps.controller;
  const auth = authenticate(deps.tokenService);

  router.get('/me', auth, c.getMe);

  router.patch('/me', auth, audit('identity.update-profile'), validate(updateMeSchema), c.updateMe);

  return router;
}
