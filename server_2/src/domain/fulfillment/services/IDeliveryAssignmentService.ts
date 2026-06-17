// Domain service interface for choosing the next rider to offer a delivery to
// (fulfillment_module.md §2.6). The implementation is a SIMPLE strategy — first available rider in
// the restaurant's zone (optionally nearest, fed by RiderLocationUpdated). No orchestration engine,
// no optimisation solver. Pluggable behind this interface so the strategy can evolve (§14.4).
import { DeliveryAddress } from '../value-objects/DeliveryAddress';

export interface PickNextRiderInput {
  restaurantId: string;
  address: DeliveryAddress;
  // Riders already tried for this fulfillment (rejected/expired) — never re-offer to them.
  excludeRiderIds: string[];
}

export interface IDeliveryAssignmentService {
  // Returns the next candidate riderId for a fulfillment, or null if none is available.
  pickNextRider(input: PickNextRiderInput): Promise<string | null>;
}
