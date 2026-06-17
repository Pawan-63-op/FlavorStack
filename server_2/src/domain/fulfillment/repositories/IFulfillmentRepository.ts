// Domain repository contract for the Fulfillment aggregate (fulfillment_module.md §2.5).
//
// Phase 1: save, findById, findByOrderRequestId.
// Phase 2: update (optimistic concurrency on version), findActiveByRestaurant.
import { Fulfillment } from '../entities/Fulfillment';

export interface IFulfillmentRepository {
  save(fulfillment: Fulfillment): Promise<void>;
  update(fulfillment: Fulfillment): Promise<void>;
  findById(id: string): Promise<Fulfillment | null>;
  findByOrderRequestId(orderRequestId: string): Promise<Fulfillment | null>;
  findActiveByRestaurant(restaurantId: string, status?: string): Promise<Fulfillment[]>;
}
