import { Restaurant } from '../../../../domain/catalog/entities/Restaurant';
import { Result } from '../../../../domain/shared/Result';
import { ForbiddenError } from '../../../../domain/shared/errors/ForbiddenError';
import { ActorContext } from '../../dtos/shared';

/**
 * Restaurant ownership is enforced in the use-case (not just middleware):
 * the actor must be the restaurant's owner, or hold a super-admin context.
 */
export function assertRestaurantOwnership(restaurant: Restaurant, actor: ActorContext): Result<void> {
  if (actor.isSuperAdmin) return Result.ok<void>();
  if (restaurant.ownerId !== actor.actorId) {
    return Result.fail<void>(new ForbiddenError('not_restaurant_owner'));
  }
  return Result.ok<void>();
}
