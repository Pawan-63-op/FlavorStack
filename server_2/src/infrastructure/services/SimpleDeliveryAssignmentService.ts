import {
  IDeliveryAssignmentService,
  PickNextRiderInput,
} from '../../domain/fulfillment/services/IDeliveryAssignmentService';

/**
 * Resolves the riders currently eligible to take a job for `restaurantId`, nearest to that
 * restaurant first. Ordering is the provider's responsibility (see `AvailableDriversProvider`);
 * this service only excludes and picks.
 */
export type AvailableRidersProvider = (restaurantId: string) => Promise<string[]>;

export class SimpleDeliveryAssignmentService implements IDeliveryAssignmentService {
  constructor(private readonly listAvailableRiders: AvailableRidersProvider) {}

  async pickNextRider(input: PickNextRiderInput): Promise<string | null> {
    const candidates = await this.listAvailableRiders(input.restaurantId);
    const excluded = new Set(input.excludeRiderIds);
    const next = candidates.find((riderId) => !excluded.has(riderId));
    return next ?? null;
  }

  async isRiderAssignable(riderId: string, restaurantId: string): Promise<boolean> {
    const candidates = await this.listAvailableRiders(restaurantId);
    return candidates.includes(riderId);
  }
}
