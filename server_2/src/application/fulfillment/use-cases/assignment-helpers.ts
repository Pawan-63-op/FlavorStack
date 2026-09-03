import { Result } from '../../../domain/shared/Result';
import { ConflictError } from '../../../domain/shared/errors/ConflictError';
import { ValidationError } from '../../../domain/shared/errors/ValidationError';
import { Fulfillment } from '../../../domain/fulfillment/entities/Fulfillment';
import { IDeliveryAssignmentService } from '../../../domain/fulfillment/services/IDeliveryAssignmentService';

export function triedRiderIds(fulfillment: Fulfillment): string[] {
  const tried = fulfillment.assignmentHistory.map((a) => a.riderId);
  if (fulfillment.currentAssignment) tried.push(fulfillment.currentAssignment.riderId);
  return tried;
}

export function offerExpiry(ttlSeconds: number): Date {
  return new Date(Date.now() + ttlSeconds * 1000);
}

export interface RiderChoiceDeps {
  assignmentService: IDeliveryAssignmentService;
  maxAssignmentAttempts: number;
}

/**
 * The rider-selection rules `AssignRider` and `ReassignRider` must not disagree on.
 *
 * 1. **The attempt cap is enforced here, not only in `HandleAssignmentTimeout`.** It used to live
 *    solely in the timeout handler, so an admin could loop `/admin/fulfillments/:id/reassign` past
 *    the cap the automatic path respects.
 * 2. **An explicitly-named rider is validated.** Without this, an admin could offer a delivery to
 *    any string — a customer's id, an offline rider, or one already on another job.
 */
export async function chooseRider(
  fulfillment: Fulfillment,
  deps: RiderChoiceDeps,
  explicitRiderId?: string
): Promise<Result<string>> {
  if (fulfillment.assignmentHistory.length >= deps.maxAssignmentAttempts) {
    return Result.fail<string>(new ConflictError('assignment_attempts_exhausted'));
  }

  if (explicitRiderId) {
    const assignable = await deps.assignmentService.isRiderAssignable(
      explicitRiderId,
      fulfillment.restaurantId
    );
    if (!assignable) return Result.fail<string>(new ValidationError('rider_not_available'));
    return Result.ok<string>(explicitRiderId);
  }

  const riderId = await deps.assignmentService.pickNextRider({
    restaurantId: fulfillment.restaurantId,
    excludeRiderIds: triedRiderIds(fulfillment),
  });
  if (!riderId) return Result.fail<string>(new ConflictError('no_available_rider'));

  return Result.ok<string>(riderId);
}
