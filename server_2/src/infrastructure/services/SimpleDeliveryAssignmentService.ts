import {
  IDeliveryAssignmentService,
  PickNextRiderInput,
} from '../../domain/fulfillment/services/IDeliveryAssignmentService';

export type AvailableRidersProvider = (restaurantId: string) => Promise<string[]>;

export class SimpleDeliveryAssignmentService implements IDeliveryAssignmentService {
  constructor(private readonly listAvailableRiders: AvailableRidersProvider) {}

  async pickNextRider(input: PickNextRiderInput): Promise<string | null> {
    const candidates = await this.listAvailableRiders(input.restaurantId);
    const excluded = new Set(input.excludeRiderIds);
    const next = candidates.find((riderId) => !excluded.has(riderId));
    return next ?? null;
  }
}
