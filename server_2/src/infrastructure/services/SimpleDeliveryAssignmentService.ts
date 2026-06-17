// Simple implementation of IDeliveryAssignmentService (fulfillment_module.md §2.6, §14.4).
//
// Strategy: ask an injected candidate source for the riders available to a restaurant, then return
// the FIRST one not already excluded (rejected/expired on this fulfillment). No orchestration engine
// and no optimisation solver — "nearest in zone" is a future refinement behind the same interface.
//
// The candidate source is injected (rather than reaching into Identity/Catalog) so this stays a pure
// strategy: a later phase feeds it from the RiderLocationUpdated-backed read model. Until that read
// model exists, the provider can be a static list (tests) or a no-op (returns no candidates).
import {
  IDeliveryAssignmentService,
  PickNextRiderInput,
} from '../../domain/fulfillment/services/IDeliveryAssignmentService';

// Returns the riderIds currently available to take a delivery for the given restaurant, in
// preference order (e.g. nearest first once a location read model feeds it).
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
