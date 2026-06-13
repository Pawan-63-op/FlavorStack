// Derives the catalog ActorContext from the verified JWT claims on the request.
// Super-admin is modeled as the platform ADMIN role; ownership itself is always
// re-checked inside the use-case against `restaurant.ownerId`.
import { Request } from 'express';
import { USER_ROLE } from '../../../../domain/identity/enums/user-role.enum';
import { ActorContext } from '../../../../application/catalog/dtos/shared';

export function actorFrom(req: Request): ActorContext {
  return {
    actorId: req.user!.userId,
    isSuperAdmin: req.user!.role === USER_ROLE.ADMIN,
  };
}
