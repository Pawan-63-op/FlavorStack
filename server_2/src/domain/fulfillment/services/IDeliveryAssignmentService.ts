import { DeliveryAddress } from '../value-objects/DeliveryAddress';

export interface PickNextRiderInput {
  restaurantId: string;
  address: DeliveryAddress;
  excludeRiderIds: string[];
}

export interface IDeliveryAssignmentService {
  pickNextRider(input: PickNextRiderInput): Promise<string | null>;
}
