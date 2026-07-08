import { Fulfillment } from '../entities/Fulfillment';

export interface IFulfillmentRepository {
  save(fulfillment: Fulfillment): Promise<void>;
  update(fulfillment: Fulfillment): Promise<void>;
  findById(id: string): Promise<Fulfillment | null>;
  findByOrderRequestId(orderRequestId: string): Promise<Fulfillment | null>;
  findActiveByRestaurant(restaurantId: string, status?: string): Promise<Fulfillment[]>;
}
