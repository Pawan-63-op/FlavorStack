import { Request } from 'express';
import { USER_ROLE } from '../../../../domain/identity/enums/user-role.enum';
import { ActorContext } from '../../../../application/catalog/dtos/shared';

export function actorFrom(req: Request): ActorContext {
  return {
    actorId: req.user!.userId,
    isSuperAdmin: req.user!.role === USER_ROLE.ADMIN,
  };
}
